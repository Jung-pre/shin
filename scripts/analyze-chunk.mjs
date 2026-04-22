import fs from "node:fs";
import path from "node:path";

const dir = ".next/static/chunks";
const pkgs = [
  "three",
  "@react-three/drei",
  "@react-three/fiber",
  "gsap",
  "framer-motion",
  "lenis",
  "three-mesh-bvh",
  "three-bvh-csg",
  "three-stdlib",
];

function walk(d) {
  let out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) out = out.concat(walk(f));
    else if (f.endsWith(".js")) out.push(f);
  }
  return out;
}

const files = walk(dir).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size).slice(0, 10);
for (const file of files) {
  const c = fs.readFileSync(file, "utf8");
  const size = (fs.statSync(file).size / 1024).toFixed(1);
  const hits = pkgs
    .map((p) => {
      const rx = new RegExp("node_modules/" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      const m = c.match(rx);
      return [p, m ? m.length : 0];
    })
    .filter(([, n]) => n > 0)
    .map(([p, n]) => `${p}=${n}`)
    .join(", ");
  console.log(`${size.padStart(8)} KB  ${path.basename(file)}  [${hits || "-"}]`);
}
