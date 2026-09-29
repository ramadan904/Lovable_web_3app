// Turns dist-artifact/ into one HTML fragment for an Artifact page: CSS and JS inlined,
// Google Fonts as the only external resource. Usage: npm run build:artifact
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const dir = "dist-artifact/assets";
const files = readdirSync(dir);
const js = readFileSync(`${dir}/${files.find((f) => f.endsWith(".js"))}`, "utf8").replace(/<\/script/gi, "<\\/script");
const css = readFileSync(`${dir}/${files.find((f) => f.endsWith(".css"))}`, "utf8").replace(/<\/style/gi, "<\\/style");

const html = `<title>Fernhill Mobile Detail</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
writeFileSync("dist-artifact/fernhill.html", html);
console.log(`fernhill.html: ${(html.length / 1024).toFixed(0)} KB`);
