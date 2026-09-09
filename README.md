# Hamlet Builder

<img src="https://raw.githubusercontent.com/zkreations/hamlet-builder/main/hamlet-logo.png" align="left" alt="Hamlet Builder" />

[![V](https://img.shields.io/npm/v/hamlet-builder)](https://www.npmjs.com/package/hamlet-builder) [![L](https://img.shields.io/npm/l/hamlet-builder)](LICENSE) [![Node](https://img.shields.io/node/v/hamlet-builder)](package.json)

Compiler for Blogger theme development. Powers the official [Hamlet](https://github.com/zkreations/hamlet/) theme and any Blogger themes derived from it.

---

## Features

- **Template compilation**: Compiles Handlebars (`.hbs`, `.handlebars`) and XML (`.xml`) templates into Blogger XML.
- **JavaScript & TypeScript bundling**: Bundles `.js`, `.mjs`, `.cjs`, `.ts`, and `.tsx` scripts via Rollup and esbuild.
- **CSS processing**: Compiles SCSS, SASS, and CSS using Sass, PostCSS, and LightningCSS with `browserslist` target resolution.
- **Source maps**: Generated for styles and scripts via the `-s, --sourcemap` flag or configuration.
- **Minification**: LightningCSS (CSS) and Terser (JS), configurable globally or per asset type.
- **Project inspection**: `--inspect` command outputs a report of partials, helper counts, unused partials, and name collision warnings.
- **Blogger normalizations**:
  - Self-closes void HTML tags (`<meta>`, `<link>`, `<img>`, etc.) for XML compliance.
  - Injects standard root attributes into `<html>`.
  - Collapses multiline Blogger expressions (`expr:*`, `cond`, `values`, `value`) onto single lines, preserving CDATA and script/style blocks.
  - Expands simplified `<Variable>` and `<b:widget>` markup.
- **Asset helpers**: Embed file assets with `asset`, or use `assetCss` and `assetJs` to switch between development and minified production bundles.
- **Built-in partials and skin variables**: Ships with Hamlet functions and overrides, and converts theme skin `<Group>` variables into CSS custom properties via `hamlet.skinVars`.
- **Plugin system**: Add namespaced helpers, partials, and data context via plugins.
- **Error reporting**: File paths, line and column positions, and partial inclusion stack traces on compilation errors.

---

## Requirements

- Node.js `>= 22.0.0`

---

## Installation

```bash
npm install hamlet-builder --save-dev
```

```bash
pnpm add -D hamlet-builder
# or
yarn add -D hamlet-builder
```

> [!NOTE]
> You can invoke the CLI using either `hamlet` or `hamlet-builder`.

---

## CLI Flags

| Flag | Short Flag | Description | Default |
| --- | --- | --- | --- |
| `--input <path>` | `-i` | Path to source directory | `./src` |
| `--output <path>` | `-o` | Path to build output directory | `./dist` |
| `--mode <mode>` | `-m` | Set build mode: `development` or `production` | `development` |
| `--watch` | `-w` | Watch source files and recompile on changes | `false` |
| `--inspect` | | Inspect project partials, configurations, and diagnostics | `false` |
| `--info` | `-I` | Alias for `--inspect` | `false` |
| `--sourcemap` | `-s` | Generate source maps for CSS and JavaScript files | `false` |
| `--no-minify` | `-n` | Disable minification for all assets | `false` |
| `--no-minify-css` | | Disable minification for CSS only | `false` |
| `--no-minify-js` | | Disable minification for JavaScript only | `false` |

---

## Usage

Add compilation scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "hamlet --mode development --watch",
    "build": "hamlet --mode production",
    "build:sourcemap": "hamlet --mode production --sourcemap",
    "inspect": "hamlet --inspect"
  }
}
```

```bash
npm run dev      # Development mode with file watching
npm run build    # Production build
npm run inspect  # Project diagnostics
```

You can also run the CLI directly using `npx`:

```bash
npx hamlet --mode development --watch
```

---

## Project Structure & Conventions

Hamlet Builder scans the source folder (`./src` by default) for files matching these conventions:

```bash
src/
├── css/
│   ├── _variables.scss       # Ignored as entry (partial due to '_')
│   ├── _mixins.scss          # Ignored as entry (partial due to '_')
│   └── main.scss             # Compiled to dist/css/main.css & main.min.css
├── js/
│   ├── utils.ts              # Ignored as entry (module imported by bundle)
│   ├── component.tsx         # Ignored as entry (module imported by bundle)
│   └── app.bundle.ts         # Compiled to dist/js/app.js & app.min.js
└── templates/
    ├── partials/
    │   ├── _header.hbs       # Registered partial: {{> header}}
    │   └── _footer.hbs       # Registered partial: {{> footer}}
    └── theme.xml             # Compiled to dist/theme.xml
```

### 1. Styles (`scss`, `sass`, `css`)

- Files whose name does not begin with `_` are treated as entry points.
- Entry files are compiled through Sass, PostCSS, and LightningCSS and output to `dist/css/[name].css`.
- In production, an additional `[name].min.css` is generated.
- Files prefixed with `_` are treated as partials and are not compiled directly.

> [!TIP]
> PostCSS plugins are applied after Sass compilation, so you can combine PostCSS plugins (like Autoprefixer or Tailwind CSS) with Sass.

### 2. Scripts (`js`, `mjs`, `cjs`, `ts`, `tsx`)

- Only files ending with `.bundle.@(js|mjs|cjs|ts|tsx)` are treated as entry points (e.g., `app.bundle.ts`).
- Non-bundle files are treated as modules and can be imported with standard ES import syntax.
- TypeScript and TSX are supported via `esbuild` without extra configuration.
- The `.bundle` suffix is stripped in the output, producing `dist/js/[name].js` and `dist/js/[name].min.js`.
- Bundles are compiled as IIFE scripts. The function name is derived from the entry file name.

### 3. Templates (`xml`, `hbs`, `handlebars`)

- Files not prefixed with `_` are compiled into Blogger themes (e.g., `theme.xml` compiles to `dist/theme.xml`).
- Files prefixed with `_` are registered as Handlebars partials using their filename without the underscore and extension:
  - `src/templates/_header.hbs` &rarr; `{{> header}}`
  - `src/components/_card.xml` &rarr; `{{> card}}`

#### Folder Partials

When partials are organized in a folder, Hamlet Builder generates a combined partial for that folder:

```handlebars
{{> folder.FOLDER_NAME}}
```

For example, if you have `src/templates/widgets/_recent.hbs` and `src/templates/widgets/_popular.hbs`, calling `{{> folder.widgets}}` will include all partials in that folder in alphabetical order.

---

## Handlebars Helpers

### Asset Helpers

#### `{{asset "<path>"}}`

Inlines the raw text content of a file into your template at build time. Supports path resolution relative to the project root.

```handlebars
<style>
  {{asset "dist/css/main.css"}}
</style>
<script>
  {{asset "dist/js/main.js"}}
</script>
```

Files from `node_modules` can be referenced using the `~` prefix:

```handlebars
<style>
  {{asset "~/normalize.css/normalize.css"}}
</style>
```

> [!IMPORTANT]
> `asset` blocks path traversal outside the project directory, restricts allowed file extensions (`.css`, `.js`, `.html`, `.xml`, `.svg`, `.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.toml`), and guards against circular references.

#### `{{assetCss "<name>"}}`

Inlines a compiled CSS file from the output directory. Resolves to the unminified file in development mode and the minified file in production:

- **Development**: Inlines `dist/css/[name].css`
- **Production**: Inlines `dist/css/[name].min.css`

```handlebars
<style>
  {{assetCss "main"}}
</style>
```

`"main"` and `"main.css"` are interchangeable.

#### `{{assetJs "<name>"}}`

Inlines a compiled JavaScript bundle from the output directory:

- **Development**: Inlines `dist/js/[name].js`
- **Production**: Inlines `dist/js/[name].min.js`

```handlebars
<script>
  {{assetJs "main"}}
</script>
```

`"main"` and `"main.js"` are interchangeable.

---

### Logic & Comparison Helpers

| Helper | Description | Example |
| --- | --- | --- |
| `eq` | Strict equality (`===`) | `{{#if (eq view.type "post")}}...{{/if}}` |
| `ne` | Strict inequality (`!==`) | `{{#if (ne view.type "index")}}...{{/if}}` |
| `lt` | Less than (`<`) | `{{#if (lt count 10)}}...{{/if}}` |
| `gt` | Greater than (`>`) | `{{#if (gt posts.length 0)}}...{{/if}}` |
| `and` | Logical AND (`&&`) | `{{#if (and isPost hasThumbnail)}}...{{/if}}` |
| `or` | Logical OR (`\|\|`) | `{{#if (or isPost isPage)}}...{{/if}}` |
| `not` | Logical NOT (`!`) | `{{#if (not isError)}}...{{/if}}` |

---

### String & Array Helpers

| Helper | Description | Example |
| --- | --- | --- |
| `concat` | Concatenates multiple strings | `{{concat "prefix-" category "-suffix"}}` |
| `includes` | Checks if a string contains a substring | `{{#if (includes title "Hamlet")}}...{{/if}}` |
| `capitalize` | Capitalizes the first letter of a string | `{{capitalize "author"}}` &rarr; `Author` |
| `first` | Returns the first element of an array | `{{first labels}}` |
| `last` | Returns the last element of an array | `{{last labels}}` |
| `currentYear` | Outputs the current 4-digit year | `&copy; {{currentYear}} My Site` |

---

### Control Flow (`switch`, `case`, `default`)

Multi-branch conditional blocks with nested switch support:

```handlebars
{{#switch view.type}}
  {{#case "item"}}
    <!-- Single post layout -->
  {{/case}}
  {{#case "page"}}
    <!-- Static page layout -->
  {{/case}}
  {{#default}}
    <!-- Index / Archive layout -->
  {{/default}}
{{/switch}}
```

---

## Built-in Hamlet Partials

Partials prefixed with `hamlet.` are included with the builder.

| Partial | Type | Description |
| --- | --- | --- |
| `hamlet.functions` | Includable Group | Injects all Hamlet function includables |
| `hamlet.overrides` | Includable Group | Injects all default markup overrides |
| `hamlet.defaultmarkups` | Override | Suppresses Blogger's auto-generated default widget markups |
| `hamlet.meta` | Function | SEO metadata, Open Graph, Twitter Cards, and canonical URLs |
| `hamlet.picture` | Function | Responsive `<picture>` tag with Blogger thumbnail sizing |
| `hamlet.image` | Function | Responsive `<img>` tag with srcset and Blogger resize parameters |
| `hamlet.avatar` | Function | User avatar with fallback image and resizing |
| `hamlet.snippet` | Function | Text snippet with configurable length and ellipsis |
| `hamlet.menu` | Function | Nested navigation menu from Blogger LinkList widgets |
| `hamlet.kind` | Function | Injects context classes into `<body>` based on the active view |
| `hamlet.contrast` | Function | Calculates brightness contrast (`light` / `dark`) from skin variables |
| `hamlet.attr` | Function | Adds or removes multiple HTML attributes programmatically |
| `hamlet.adsense` | Function | Async AdSense script loader |
| `hamlet.ads` | Function | Responsive AdSense ad slot |
| `hamlet.skinVars` | Generated | CSS custom properties derived from theme `<Group>` skin variables |

> [!TIP]
> For complete parameter lists and usage examples, see [src/README.md](src/README.md).

### Theme Skin Variables (`hamlet.skinVars`)

Hamlet Builder extracts `<Group>` skin variable declarations from your source files:

```xml
<Group description="Theme Colors">
  <Variable name="theme.primary" type="color" default="#0066cc"/>
</Group>
```

Invoking `{{> hamlet.skinVars}}` outputs CSS custom properties:

```css
/* Theme Colors Group */
--theme-primary: $(theme.primary);
```

For font variables, it generates both the font rule and the family rule (`--var-name` and `--var-name-family`).

---

## Blogger Normalizations

Hamlet Builder handles several repetitive requirements of Blogger XML automatically.

### 1. Void Tag Self-Closing

Standard HTML void tags (`<meta>`, `<link>`, `<img>`, `<input>`, `<br>`, `<hr>`, `<area>`, `<base>`, `<col>`, `<embed>`, `<param>`, `<source>`, `<track>`, `<wbr>`) are converted to self-closing XML tags to prevent validation errors when uploading themes to Blogger.

### 2. Root Element Normalization

A simple `<html>` tag:

```xml
<html class='theme'>
```

Is expanded to:

```xml
<html class='theme' b:css='false' b:js='false' b:defaultwidgetversion='2' b:layoutsVersion='3' expr:dir='data:blog.languageDirection' expr:lang='data:blog.locale'>
```

### 3. Simplified Variables

Declare skin variables concisely:

```xml
<Variable name="brandColor"/>
```

Compiled output:

```xml
<Variable name='brandColor' description='brandColor' type='string'/>
```

### 4. Simplified Widgets

Omit boilerplate from `<b:widget>`:

```xml
<b:widget/>
<b:widget type='PopularPosts'/>
<b:widget type='Label'/>
<b:widget type='Label'/>
```

Compiled output:

```xml
<b:widget id='HTML1' type='HTML' version='2'/>
<b:widget id='PopularPosts1' type='PopularPosts' version='2'/>
<b:widget id='Label1' type='Label' version='2'/>
<b:widget id='Label2' type='Label' version='2'/>
```

If `type` is omitted or invalid, it defaults to `HTML`.

### 5. Multiline Expression Normalization

Line breaks and excess whitespace in Blogger expression attributes (`expr:*`, `cond`, `values`, `value`) are collapsed onto single lines:

```xml
<b:include name='@image' data='{
  src: data:post.featuredImage,
  resize: (data:isThumbnail ? 320 : 800)
}'/>
```

Compiled output:

```xml
<b:include name='@image' data='{ src: data:post.featuredImage, resize: (data:isThumbnail ? 320 : 800) }'/>
```

CDATA blocks, `<script>`, and `<style>` blocks are preserved as-is.

---

## Configuration Files

Hamlet Builder discovers configuration files at the project root or inside a `.config/` directory.

| Name | Formats | Example Files |
| --- | --- | --- |
| **Hamlet** | `.js`, `.mjs`, `.cjs`, `.json` | `hamlet.config.js`, `.hamletrc.js`, `.config/hamletrc.js` |
| **Theme** | `.json`, `package.json` | `theme.config.json`, `.themerc.json`, `"theme"` field in `package.json` |
| **PostCSS** | `.js`, `.mjs`, `.cjs`, `.json` | `postcss.config.js`, `.postcssrc.js` |
| **Rollup** | `.js`, `.mjs`, `.cjs` | `rollup.config.js`, `.rolluprc.js` |

---

### Hamlet Configuration (`hamlet.config.js`)

```js
import myPlugin from 'hamlet-plugin-custom'

export default {
  // Recompile CSS when any template changes (useful for Tailwind CSS)
  recompileOnAnyChange: false,

  // Enable sourcemaps for CSS and JS
  sourcemap: false,

  // Project-level custom Handlebars helpers
  helpers: {
    formatPrice: amount => `$${Number(amount).toFixed(2)}`,
  },

  // Custom options passed to rollup-plugin-esbuild
  esbuild: {
    target: 'es2020',
  },

  // Hamlet plugins
  plugins: [
    myPlugin(),
  ],
}
```

#### Dynamic Configuration with Context

Export a function to access project paths:

```js
export default ({ paths, utils }) => ({
  recompileOnAnyChange: true,
  helpers: {
    assetPath: file => utils.resolve(paths.dist, file),
  },
})
```

Available context parameters:
- `paths.root`: Absolute path to project root.
- `paths.src`: Absolute path to input directory.
- `paths.dist`: Absolute path to output directory.
- `utils.resolve(...args)`: Path resolution relative to project root.

---

### Theme Configuration (`theme.config.json`)

Data defined in `theme.config.json` (or the `"theme"` field in `package.json`) is merged into the Handlebars template context:

```json
{
  "name": "My Blogger Theme",
  "author": "Daniel",
  "version": "1.0.0"
}
```

In your templates:

```handlebars
<h1>{{name}}</h1>
<p>Created by {{author}}</p>
```

#### Global Template Variables

| Variable | Type | Description |
| --- | --- | --- |
| `development` | boolean | `true` when `--mode development`, `false` when `--mode production` |
| `defaultmarkups` | object | Built-in markup keys used by `{{> hamlet.defaultmarkups}}` |

```handlebars
{{#if development}}
  <!-- Developer bar or live-reload scripts -->
{{/if}}
```

---

### Plugin Development

A plugin is a factory function returning an object with a unique `namespace`:

```js
export default function iconsPlugin(options = {}) {
  return {
    namespace: 'icons',
    context: {
      spritePath: options.spritePath ?? '/assets/icons.svg',
    },
    helpers: {
      iconName: name => `icon-${name}`,
    },
    partials: {
      svg: '<svg><use href="{{icons.spritePath}}#{{name}}"></use></svg>',
    },
  }
}
```

In any template:
- Partials: `{{> icons.svg name="search"}}`
- Context data: `{{icons.spritePath}}`

> [!TIP]
> Use the official starter template to publish a plugin: [hamlet-plugin-template](https://github.com/zkreations/hamlet-plugin-template).

---

## Project Inspection

```bash
npx hamlet --inspect
# or
npx hamlet -I
```

Outputs a structured terminal report with:
- Active configuration: input, output, mode, minification, and recompile flags.
- Built-in partials: which `hamlet.*` partials are referenced vs. available.
- Project partials: all detected partials organized by folder, with unused partials flagged.
- Folder partials: all generated `folder.<name>` partials with member counts.
- Plugin partials: partials contributed by plugins, grouped by namespace.
- Registered helpers: counts of built-in and custom helpers.
- Diagnostics: name collision warnings with exact file paths.

---

## Error Reporting

On compilation failure, Hamlet Builder reports file paths, line and column numbers, and for template errors, the full partial inclusion stack trace:

```text
[error] The partial "nav_item" could not be found
  src/templates/partials/_menu.hbs:4:6
  included from src/templates/partials/_header.hbs:12:4
  included from src/templates/theme.xml:18:2
```

---

## Author

Created and maintained by [zkreations](https://github.com/zkreations).

- Website: [zkreations.com](https://www.zkreations.com/)
- Ko-fi: [ko-fi.com/zkreations](https://ko-fi.com/zkreations)

If you use Hamlet Builder in your themes, consider tagging your repositories with `blogger-hamlet` and `hamlet-builder`

---

## License

**Hamlet-builder** is licensed under the MIT License
