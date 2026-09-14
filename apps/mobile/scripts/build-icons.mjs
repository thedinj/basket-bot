/**
 * Regenerate every launcher/PWA icon asset from one finished 1:1 render.
 *
 *   node scripts/build-icons.mjs <source.png|jpg>
 *
 * The source is the finished full-bleed square icon on its flat purple field.
 * `resources/icon.svg` is the geometry master; the source raster is that drawing
 * with its satin finish applied.
 *
 * Writes:
 *   resources/icon.png                      1024, flattened
 *   resources/android/icon-foreground.png   1024, purple field cut to alpha
 *   icons/icon-{48..512}.webp               the set public/manifest.json points at
 *   public/favicon.png, public/img/icon.png copies of resources/icon.png
 *
 * Does NOT touch resources/android/icon-background.png or either splash.
 * After running, `npx capacitor-assets generate --android` fans out the densities.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

const require = createRequire(import.meta.url);

/**
 * sharp is not a direct dependency here - it arrives transitively via @capacitor/assets,
 * which pins an older copy whose native binary is not built for every platform. So walk
 * the pnpm store newest-first and take the first one that actually loads.
 */
const loadSharp = async () => {
    try {
        return require("sharp");
    } catch {
        /* not hoisted; fall through to the store */
    }

    const store = path.resolve(ROOT_GUESS, "node_modules", ".pnpm");
    let entries = [];
    try {
        entries = (await fs.readdir(store)).filter((d) => /^sharp@\d/.test(d));
    } catch {
        throw new Error(`cannot read pnpm store at ${store}`);
    }

    const byVersionDesc = (a, b) =>
        b.slice(6).localeCompare(a.slice(6), undefined, { numeric: true });

    const failures = [];
    for (const dir of entries.sort(byVersionDesc)) {
        const candidate = path.join(store, dir, "node_modules", "sharp");
        try {
            return require(candidate);
        } catch (err) {
            failures.push(`  ${dir}: ${err.message.split("\n")[0]}`);
        }
    }
    throw new Error(`no loadable sharp found:\n${failures.join("\n")}`);
};

const ROOT_GUESS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const sharp = await loadSharp();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.argv[2];

if (!SRC) {
    console.error("usage: node scripts/build-icons.mjs <source image>");
    process.exit(1);
}

const at = (...p) => path.join(ROOT, ...p);

/**
 * Replace the flat field with alpha.
 *
 * Flood-fills inward from the border instead of keying on colour globally: the mouth is
 * only 83 away from the field colour, so a global key would punch a hole through it.
 * The RGBA buffer is interleaved by hand because sharp's joinChannel misreads the stride
 * on a raw pipeline.
 *
 * Tolerance is bounded from above by the drop shadow, not by the field. The field is flat
 * enough that even 30 cuts it completely, but the shadow the render casts is a dark purple
 * within ~55 of the field colour - so at 80 the fill starts creeping along the shadow into
 * the seam behind each ear drum, and by 100 it bites a visible notch out of the drum. 60
 * clears the field with room for JPEG noise and stops short of the shadow. Raise it only
 * after checking the drum/casing junction in the output.
 */
const cutField = async (src, tolerance = 60) => {
    const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: W, height: H, channels: C } = info;

    const fr = data[0];
    const fg = data[1];
    const fb = data[2];
    const dist = (p) => {
        const i = p * C;
        return Math.abs(data[i] - fr) + Math.abs(data[i + 1] - fg) + Math.abs(data[i + 2] - fb);
    };

    const keep = new Uint8Array(W * H).fill(255);
    const stack = new Int32Array(W * H);
    let sp = 0;
    const push = (x, y) => {
        const p = y * W + x;
        if (keep[p] === 0 || dist(p) > tolerance) return;
        keep[p] = 0;
        stack[sp++] = p;
    };

    for (let x = 0; x < W; x++) {
        push(x, 0);
        push(x, H - 1);
    }
    for (let y = 0; y < H; y++) {
        push(0, y);
        push(W - 1, y);
    }
    while (sp > 0) {
        const p = stack[--sp];
        const x = p % W;
        const y = (p - x) / W;
        if (x > 0) push(x - 1, y);
        if (x < W - 1) push(x + 1, y);
        if (y > 0) push(x, y - 1);
        if (y < H - 1) push(x, y + 1);
    }

    // Separable box blur, so the binary edge gets a one-pixel ramp instead of jaggies.
    const R = 2;
    const span = 2 * R + 1;
    const blur = (srcArr) => {
        const tmp = new Float32Array(W * H);
        const out = new Float32Array(W * H);
        for (let y = 0; y < H; y++) {
            let acc = 0;
            for (let x = -R; x <= R; x++) acc += srcArr[y * W + Math.min(W - 1, Math.max(0, x))];
            for (let x = 0; x < W; x++) {
                tmp[y * W + x] = acc / span;
                acc += srcArr[y * W + Math.min(W - 1, x + R + 1)] - srcArr[y * W + Math.max(0, x - R)];
            }
        }
        for (let x = 0; x < W; x++) {
            let acc = 0;
            for (let y = -R; y <= R; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
            for (let y = 0; y < H; y++) {
                out[y * W + x] = acc / span;
                acc += tmp[Math.min(H - 1, y + R + 1) * W + x] - tmp[Math.max(0, y - R) * W + x];
            }
        }
        return out;
    };
    const soft = blur(keep);

    const rgba = Buffer.alloc(W * H * 4);
    for (let p = 0; p < W * H; p++) {
        const s = p * C;
        const d = p * 4;
        rgba[d] = data[s];
        rgba[d + 1] = data[s + 1];
        rgba[d + 2] = data[s + 2];
        rgba[d + 3] = Math.round(Math.min(255, Math.max(0, soft[p])));
    }

    let cut = 0;
    for (let i = 0; i < keep.length; i++) if (keep[i] === 0) cut++;
    return { rgba, W, H, field: [fr, fg, fb], cutPct: (100 * cut) / keep.length };
};

const meta = await sharp(SRC).metadata();
console.log(`source  ${path.basename(SRC)}  ${meta.width}x${meta.height} ${meta.format}`);
if (meta.width !== meta.height) console.warn("  ! source is not square");

// --- resources/icon.png -------------------------------------------------------
await sharp(SRC).removeAlpha().resize(1024, 1024, { kernel: "lanczos3" }).png({ compressionLevel: 9 })
    .toFile(at("resources", "icon.png"));
console.log("wrote   resources/icon.png  1024");

// --- resources/android/icon-foreground.png ------------------------------------
const { rgba, W, H, field, cutPct } = await cutField(SRC);
await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .resize(1024, 1024, { kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toFile(at("resources", "android", "icon-foreground.png"));
console.log(
    `wrote   resources/android/icon-foreground.png  1024  ` +
        `(field rgb(${field.join(",")}), ${cutPct.toFixed(1)}% cut to alpha)`
);

// --- icons/icon-*.webp --------------------------------------------------------
const SIZES = [48, 72, 96, 128, 192, 256, 512];
for (const s of SIZES) {
    await sharp(at("resources", "icon.png"))
        .resize(s, s, { kernel: "lanczos3" })
        .webp({ quality: 92 })
        .toFile(at("icons", `icon-${s}.webp`));
}
console.log(`wrote   icons/icon-{${SIZES.join(",")}}.webp`);

// --- web copies ---------------------------------------------------------------
for (const dest of [["public", "favicon.png"], ["public", "img", "icon.png"]]) {
    await fs.copyFile(at("resources", "icon.png"), at(...dest));
    console.log(`wrote   ${dest.join("/")}`);
}

// --- android mipmaps ----------------------------------------------------------
// `capacitor-assets generate` would normally do this, but @capacitor/assets 3.0.5 pins
// sharp 0.32.6, whose native binary is not available for win32-x64 on current Node — the
// CLI throws before it starts. These are the same filenames and sizes it emits, so a
// future working install of the CLI overwrites them harmlessly.
const DENSITIES = [
    ["ldpi", 36, 81],
    ["mdpi", 48, 108],
    ["hdpi", 72, 162],
    ["xhdpi", 96, 216],
    ["xxhdpi", 144, 324],
    ["xxxhdpi", 192, 432],
];

const RES = at("android", "app", "src", "main", "res");
const roundMask = (n) =>
    Buffer.from(
        `<svg width="${n}" height="${n}"><circle cx="${n / 2}" cy="${n / 2}" r="${n / 2}" fill="#fff"/></svg>`
    );

for (const [density, launcher, adaptive] of DENSITIES) {
    const dir = path.join(RES, `mipmap-${density}`);
    await fs.mkdir(dir, { recursive: true });

    await sharp(at("resources", "icon.png"))
        .resize(launcher, launcher, { kernel: "lanczos3" })
        .png()
        .toFile(path.join(dir, "ic_launcher.png"));

    await sharp(at("resources", "icon.png"))
        .resize(launcher, launcher, { kernel: "lanczos3" })
        .composite([{ input: roundMask(launcher), blend: "dest-in" }])
        .png()
        .toFile(path.join(dir, "ic_launcher_round.png"));

    await sharp(at("resources", "android", "icon-foreground.png"))
        .resize(adaptive, adaptive, { kernel: "lanczos3" })
        .png()
        .toFile(path.join(dir, "ic_launcher_foreground.png"));

    await sharp(at("resources", "android", "icon-background.png"))
        .resize(adaptive, adaptive, { kernel: "lanczos3" })
        .png()
        .toFile(path.join(dir, "ic_launcher_background.png"));
}
console.log(`wrote   android mipmap-{${DENSITIES.map((d) => d[0]).join(",")}} (4 files each)`);

console.log("\nnext: pnpm cap:sync");
