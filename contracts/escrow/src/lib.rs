//! Fernhill deposit escrow, for Arbitrum Stylus.
//!
//! The booking app takes a refundable deposit to hold a slot. This contract is
//! that deposit's whole life, in the same four states the app already uses
//! (`held`, `refunded`, `kept`, `applied`), but with the rules enforced on-chain
//! instead of promised in a terms page:
//!
//! * The customer can always walk away for a full refund until 24 hours before
//!   the job (`cancel_free`), with no one's permission.
//! * Rain is off-chain, so the owner refunds a rain-affected booking (`refund`).
//! * The owner can only keep a deposit once the free-change window has closed
//!   (`capture`), and can claim it as part of the price once the job has started
//!   (`apply`).
//! * If the owner never settles, the customer can take the money back a week
//!   after the job (`reclaim`). Funds can never be stuck.
//!
//! The booking id is `keccak256(booking code)`, so no personal data goes on-chain.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]

extern crate alloc;

use alloy_sol_types::sol;
use stylus_sdk::{
    alloy_primitives::{
        aliases::{U64, U8},
        Address, FixedBytes, U256,
    },
    prelude::*,
};

/// Free changes and cancellations close this long before the job (the app's `FREE_CHANGE_H`).
pub const FREE_WINDOW_SECS: u64 = 24 * 60 * 60;
/// How long after the job the owner has to settle before the customer can reclaim.
pub const RECLAIM_GRACE_SECS: u64 = 7 * 24 * 60 * 60;

pub const STATE_NONE: u8 = 0;
pub const STATE_HELD: u8 = 1;
pub const STATE_REFUNDED: u8 = 2;
pub const STATE_KEPT: u8 = 3;
pub const STATE_APPLIED: u8 = 4;

sol! {
    #![sol(all_derives)]

    event Deposited(bytes32 indexed id, address indexed customer, uint256 amount, uint64 startTime);
    event Refunded(bytes32 indexed id, address indexed customer, uint256 amount);
    event Kept(bytes32 indexed id, address indexed owner, uint256 amount);
    event Applied(bytes32 indexed id, address indexed owner, uint256 amount);

    error NotOwner();
    error NotCustomer();
    error AlreadyInitialised();
    error ZeroAmount();
    error StartInPast();
    error AlreadyExists();
    error NotHeld();
    error FreeWindowClosed();
    error FreeWindowStillOpen();
    error JobNotStarted();
    error TooEarlyToReclaim();
    error TransferFailed();
}

#[derive(SolidityError, Debug)]
pub enum EscrowError {
    NotOwner(NotOwner),
    NotCustomer(NotCustomer),
    AlreadyInitialised(AlreadyInitialised),
    ZeroAmount(ZeroAmount),
    StartInPast(StartInPast),
    AlreadyExists(AlreadyExists),
    NotHeld(NotHeld),
    FreeWindowClosed(FreeWindowClosed),
    FreeWindowStillOpen(FreeWindowStillOpen),
    JobNotStarted(JobNotStarted),
    TooEarlyToReclaim(TooEarlyToReclaim),
    TransferFailed(TransferFailed),
}

sol_interface! {
    interface IERC20 {
        function transfer(address to, uint256 amount) external returns (bool);
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
    }
}

sol_storage! {
    #[entrypoint]
    pub struct FernhillEscrow {
        address owner;
        address token;
        mapping(bytes32 => Booking) bookings;
    }

    pub struct Booking {
        address customer;
        uint256 amount;
        uint64 start_time;
        uint8 state;
    }
}

#[public]
impl FernhillEscrow {
    /// `owner` is the business (Dario). `token` is the USDC/USDG deposits are paid in.
    #[constructor]
    pub fn constructor(&mut self, token: Address, owner: Address) -> Result<(), EscrowError> {
        if self.owner.get() != Address::ZERO {
            return Err(EscrowError::AlreadyInitialised(AlreadyInitialised {}));
        }
        self.token.set(token);
        self.owner.set(owner);
        Ok(())
    }

    /// Customer pays a deposit for the booking `id`, for a job starting at `start_time` (unix seconds).
    /// The customer must have approved this contract for `amount` first.
    pub fn deposit(&mut self, id: FixedBytes<32>, amount: U256, start_time: u64) -> Result<(), EscrowError> {
        if amount.is_zero() {
            return Err(EscrowError::ZeroAmount(ZeroAmount {}));
        }
        if start_time <= self.vm().block_timestamp() {
            return Err(EscrowError::StartInPast(StartInPast {}));
        }
        let customer = self.vm().msg_sender();
        {
            let mut booking = self.bookings.setter(id);
            if booking.state.get().to::<u8>() != STATE_NONE {
                return Err(EscrowError::AlreadyExists(AlreadyExists {}));
            }
            booking.customer.set(customer);
            booking.amount.set(amount);
            booking.start_time.set(U64::from(start_time));
            booking.state.set(U8::from(STATE_HELD));
        }
        // Effects are written before the external call: a re-entrant call sees `Held` with funds owed, never `None`.
        let token = IERC20::new(self.token.get());
        let this = self.vm().contract_address();
        let call = Call::new_mutating(self);
        let ok = token
            .transfer_from(self.vm(), call, customer, this, amount)
            .map_err(|_| EscrowError::TransferFailed(TransferFailed {}))?;
        if !ok {
            return Err(EscrowError::TransferFailed(TransferFailed {}));
        }
        self.vm().log(Deposited { id, customer, amount, startTime: start_time });
        Ok(())
    }

    /// Customer cancels on their own, any time up to 24 hours before the job. Full refund.
    pub fn cancel_free(&mut self, id: FixedBytes<32>) -> Result<(), EscrowError> {
        let (customer, amount, start_time) = self.held(id)?;
        if self.vm().msg_sender() != customer {
            return Err(EscrowError::NotCustomer(NotCustomer {}));
        }
        if self.vm().block_timestamp().saturating_add(FREE_WINDOW_SECS) > start_time {
            return Err(EscrowError::FreeWindowClosed(FreeWindowClosed {}));
        }
        self.settle(id, STATE_REFUNDED, customer, amount)?;
        self.vm().log(Refunded { id, customer, amount });
        Ok(())
    }

    /// Owner refunds the customer in full. Used when rain changed the booking, or the owner cancels.
    pub fn refund(&mut self, id: FixedBytes<32>) -> Result<(), EscrowError> {
        self.only_owner()?;
        let (customer, amount, _) = self.held(id)?;
        self.settle(id, STATE_REFUNDED, customer, amount)?;
        self.vm().log(Refunded { id, customer, amount });
        Ok(())
    }

    /// Owner keeps the deposit: a late cancel, a no-show, or a slot released unconfirmed.
    /// Only possible once the free-change window has closed.
    pub fn capture(&mut self, id: FixedBytes<32>) -> Result<(), EscrowError> {
        self.only_owner()?;
        let (_, amount, start_time) = self.held(id)?;
        if self.vm().block_timestamp().saturating_add(FREE_WINDOW_SECS) <= start_time {
            return Err(EscrowError::FreeWindowStillOpen(FreeWindowStillOpen {}));
        }
        let owner = self.owner.get();
        self.settle(id, STATE_KEPT, owner, amount)?;
        self.vm().log(Kept { id, owner, amount });
        Ok(())
    }

    /// Owner claims the deposit as part of the price once the job has started.
    pub fn apply(&mut self, id: FixedBytes<32>) -> Result<(), EscrowError> {
        self.only_owner()?;
        let (_, amount, start_time) = self.held(id)?;
        if self.vm().block_timestamp() < start_time {
            return Err(EscrowError::JobNotStarted(JobNotStarted {}));
        }
        let owner = self.owner.get();
        self.settle(id, STATE_APPLIED, owner, amount)?;
        self.vm().log(Applied { id, owner, amount });
        Ok(())
    }

    /// Safety net: if the owner never settles, the customer takes the deposit back a week after the job.
    pub fn reclaim(&mut self, id: FixedBytes<32>) -> Result<(), EscrowError> {
        let (customer, amount, start_time) = self.held(id)?;
        if self.vm().msg_sender() != customer {
            return Err(EscrowError::NotCustomer(NotCustomer {}));
        }
        if self.vm().block_timestamp() <= start_time.saturating_add(RECLAIM_GRACE_SECS) {
            return Err(EscrowError::TooEarlyToReclaim(TooEarlyToReclaim {}));
        }
        self.settle(id, STATE_REFUNDED, customer, amount)?;
        self.vm().log(Refunded { id, customer, amount });
        Ok(())
    }

    /// `(customer, amount, startTime, state)`. State: 0 none, 1 held, 2 refunded, 3 kept, 4 applied.
    pub fn booking(&self, id: FixedBytes<32>) -> (Address, U256, u64, u8) {
        let b = self.bookings.getter(id);
        (b.customer.get(), b.amount.get(), b.start_time.get().to::<u64>(), b.state.get().to::<u8>())
    }

    pub fn owner(&self) -> Address {
        self.owner.get()
    }

    pub fn token(&self) -> Address {
        self.token.get()
    }
}

impl FernhillEscrow {
    fn only_owner(&self) -> Result<(), EscrowError> {
        if self.vm().msg_sender() != self.owner.get() {
            return Err(EscrowError::NotOwner(NotOwner {}));
        }
        Ok(())
    }

    /// The booking's `(customer, amount, start_time)`, or `NotHeld` if it is not in the `Held` state.
    fn held(&self, id: FixedBytes<32>) -> Result<(Address, U256, u64), EscrowError> {
        let (customer, amount, start_time, state) = self.booking(id);
        if state != STATE_HELD {
            return Err(EscrowError::NotHeld(NotHeld {}));
        }
        Ok((customer, amount, start_time))
    }

    /// Moves a held booking to its final state, then pays `to`. State first, transfer second.
    fn settle(&mut self, id: FixedBytes<32>, state: u8, to: Address, amount: U256) -> Result<(), EscrowError> {
        self.bookings.setter(id).state.set(U8::from(state));
        let token = IERC20::new(self.token.get());
        let call = Call::new_mutating(self);
        let ok = token
            .transfer(self.vm(), call, to, amount)
            .map_err(|_| EscrowError::TransferFailed(TransferFailed {}))?;
        if !ok {
            return Err(EscrowError::TransferFailed(TransferFailed {}));
        }
        Ok(())
    }
}

#[cfg(feature = "export-abi")]
pub fn print_from_args() {
    stylus_sdk::abi::export::print_abi::<FernhillEscrow>("MIT-OR-APACHE-2.0", "pragma solidity ^0.8.23;");
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy_sol_types::{SolCall, SolValue};
    use stylus_sdk::testing::*;

    mod erc20 {
        use alloy_sol_types::sol;
        sol! {
            function transfer(address to, uint256 amount) external returns (bool);
            function transferFrom(address from, address to, uint256 amount) external returns (bool);
        }
    }

    const T0: u64 = 1_800_000_000;
    const DAY: u64 = 24 * 60 * 60;
    const DEPOSIT: u64 = 25_000_000; // $25.00 in 6-decimal USDC

    fn addr(n: u8) -> Address {
        Address::repeat_byte(n)
    }
    fn token() -> Address {
        addr(0xAA)
    }
    fn escrow_addr() -> Address {
        addr(0xEE)
    }
    fn dario() -> Address {
        addr(0xD0)
    }
    fn alice() -> Address {
        addr(0xA1)
    }
    fn bob() -> Address {
        addr(0xB0)
    }
    fn id() -> FixedBytes<32> {
        FixedBytes::repeat_byte(7)
    }
    fn amount() -> U256 {
        U256::from(DEPOSIT)
    }

    /// A deployed escrow, with the clock at `T0` and the caller set to `sender`.
    fn deployed() -> (TestVM, FernhillEscrow) {
        let vm = TestVM::default();
        vm.set_contract_address(escrow_addr());
        vm.set_block_timestamp(T0);
        let mut c = FernhillEscrow::from(&vm);
        c.constructor(token(), dario()).unwrap();
        (vm, c)
    }

    fn mock_pull(vm: &TestVM, from: Address, ok: bool) {
        let data = erc20::transferFromCall { from, to: escrow_addr(), amount: amount() }.abi_encode();
        vm.mock_call(token(), data, U256::ZERO, Ok(ok.abi_encode()));
    }
    fn mock_pay(vm: &TestVM, to: Address, ok: bool) {
        let data = erc20::transferCall { to, amount: amount() }.abi_encode();
        vm.mock_call(token(), data, U256::ZERO, Ok(ok.abi_encode()));
    }

    /// Alice deposits for a job starting `start_in` seconds from now.
    fn with_deposit(start_in: u64) -> (TestVM, FernhillEscrow) {
        let (vm, mut c) = deployed();
        vm.set_sender(alice());
        mock_pull(&vm, alice(), true);
        c.deposit(id(), amount(), T0 + start_in).unwrap();
        (vm, c)
    }

    fn state(c: &FernhillEscrow) -> u8 {
        c.booking(id()).3
    }

    #[test]
    fn constructor_sets_owner_and_token_once() {
        let (_vm, mut c) = deployed();
        assert_eq!(c.owner(), dario());
        assert_eq!(c.token(), token());
        let again = c.constructor(addr(1), addr(2));
        assert!(matches!(again, Err(EscrowError::AlreadyInitialised(_))));
        assert_eq!(c.owner(), dario());
    }

    #[test]
    fn deposit_records_the_booking_and_pulls_funds() {
        let (vm, c) = with_deposit(3 * DAY);
        assert_eq!(c.booking(id()), (alice(), amount(), T0 + 3 * DAY, STATE_HELD));
        assert_eq!(vm.get_emitted_logs().len(), 1);
    }

    #[test]
    fn deposit_rejects_zero_past_and_duplicates() {
        let (vm, mut c) = deployed();
        vm.set_sender(alice());
        assert!(matches!(c.deposit(id(), U256::ZERO, T0 + DAY), Err(EscrowError::ZeroAmount(_))));
        assert!(matches!(c.deposit(id(), amount(), T0), Err(EscrowError::StartInPast(_))));
        mock_pull(&vm, alice(), true);
        c.deposit(id(), amount(), T0 + 3 * DAY).unwrap();
        assert!(matches!(c.deposit(id(), amount(), T0 + 3 * DAY), Err(EscrowError::AlreadyExists(_))));
    }

    #[test]
    fn a_failed_token_pull_reverts_the_deposit() {
        let (vm, mut c) = deployed();
        vm.set_sender(alice());
        mock_pull(&vm, alice(), false);
        let r = c.deposit(id(), amount(), T0 + 3 * DAY);
        assert!(matches!(r, Err(EscrowError::TransferFailed(_))));
    }

    #[test]
    fn customer_cancels_for_a_full_refund_before_the_free_window_closes() {
        let (vm, mut c) = with_deposit(3 * DAY);
        mock_pay(&vm, alice(), true);
        c.cancel_free(id()).unwrap();
        assert_eq!(state(&c), STATE_REFUNDED);
    }

    #[test]
    fn customer_cannot_cancel_free_inside_24_hours() {
        let (vm, mut c) = with_deposit(3 * DAY);
        vm.set_block_timestamp(T0 + 2 * DAY + 60); // 23h59m left
        assert!(matches!(c.cancel_free(id()), Err(EscrowError::FreeWindowClosed(_))));
        assert_eq!(state(&c), STATE_HELD);
    }

    #[test]
    fn the_free_window_boundary_is_exactly_24_hours() {
        let (vm, mut c) = with_deposit(3 * DAY);
        vm.set_block_timestamp(T0 + 2 * DAY); // exactly 24h left: still free
        mock_pay(&vm, alice(), true);
        c.cancel_free(id()).unwrap();
    }

    #[test]
    fn only_the_depositor_can_cancel_or_reclaim() {
        let (vm, mut c) = with_deposit(3 * DAY);
        vm.set_sender(bob());
        assert!(matches!(c.cancel_free(id()), Err(EscrowError::NotCustomer(_))));
        vm.set_block_timestamp(T0 + 3 * DAY + 8 * DAY);
        assert!(matches!(c.reclaim(id()), Err(EscrowError::NotCustomer(_))));
    }

    #[test]
    fn owner_refunds_a_rain_cancellation_even_inside_the_window() {
        let (vm, mut c) = with_deposit(3 * DAY);
        vm.set_block_timestamp(T0 + 3 * DAY - 3600);
        vm.set_sender(dario());
        mock_pay(&vm, alice(), true);
        c.refund(id()).unwrap();
        assert_eq!(state(&c), STATE_REFUNDED);
    }

    #[test]
    fn owner_only_functions_reject_everyone_else() {
        let (vm, mut c) = with_deposit(3 * DAY);
        vm.set_sender(alice());
        assert!(matches!(c.refund(id()), Err(EscrowError::NotOwner(_))));
        assert!(matches!(c.capture(id()), Err(EscrowError::NotOwner(_))));
        assert!(matches!(c.apply(id()), Err(EscrowError::NotOwner(_))));
    }

    #[test]
    fn owner_cannot_keep_a_deposit_while_the_customer_can_still_cancel_free() {
        let (vm, mut c) = with_deposit(3 * DAY);
        vm.set_sender(dario());
        assert!(matches!(c.capture(id()), Err(EscrowError::FreeWindowStillOpen(_))));
        assert_eq!(state(&c), STATE_HELD);
    }

    #[test]
    fn owner_keeps_the_deposit_after_the_window_closes() {
        let (vm, mut c) = with_deposit(3 * DAY);
        vm.set_block_timestamp(T0 + 2 * DAY + 1);
        vm.set_sender(dario());
        mock_pay(&vm, dario(), true);
        c.capture(id()).unwrap();
        assert_eq!(state(&c), STATE_KEPT);
    }

    #[test]
    fn owner_applies_the_deposit_only_once_the_job_has_started() {
        let (vm, mut c) = with_deposit(3 * DAY);
        vm.set_sender(dario());
        vm.set_block_timestamp(T0 + 3 * DAY - 1);
        assert!(matches!(c.apply(id()), Err(EscrowError::JobNotStarted(_))));
        vm.set_block_timestamp(T0 + 3 * DAY);
        mock_pay(&vm, dario(), true);
        c.apply(id()).unwrap();
        assert_eq!(state(&c), STATE_APPLIED);
    }

    #[test]
    fn a_settled_booking_cannot_be_settled_again() {
        let (vm, mut c) = with_deposit(3 * DAY);
        mock_pay(&vm, alice(), true);
        c.cancel_free(id()).unwrap();
        assert!(matches!(c.cancel_free(id()), Err(EscrowError::NotHeld(_))));
        vm.set_sender(dario());
        assert!(matches!(c.refund(id()), Err(EscrowError::NotHeld(_))));
        assert!(matches!(c.capture(id()), Err(EscrowError::NotHeld(_))));
        assert!(matches!(c.apply(id()), Err(EscrowError::NotHeld(_))));
    }

    #[test]
    fn an_unknown_booking_is_not_held() {
        let (_vm, mut c) = deployed();
        assert!(matches!(c.cancel_free(id()), Err(EscrowError::NotHeld(_))));
    }

    #[test]
    fn customer_reclaims_if_the_owner_never_settles() {
        let (vm, mut c) = with_deposit(3 * DAY);
        vm.set_block_timestamp(T0 + 3 * DAY + 7 * DAY); // exactly one week: still the owner's
        assert!(matches!(c.reclaim(id()), Err(EscrowError::TooEarlyToReclaim(_))));
        vm.set_block_timestamp(T0 + 3 * DAY + 7 * DAY + 1);
        mock_pay(&vm, alice(), true);
        c.reclaim(id()).unwrap();
        assert_eq!(state(&c), STATE_REFUNDED);
    }

    #[test]
    fn a_failed_payout_reverts_the_settlement() {
        let (vm, mut c) = with_deposit(3 * DAY);
        mock_pay(&vm, alice(), false);
        assert!(matches!(c.cancel_free(id()), Err(EscrowError::TransferFailed(_))));
    }
}
