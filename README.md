


# Hamlet-builder

<img src="https://raw.githubusercontent.com/zkreations/hamlet-builder/main/hamlet-logo.png" align="left" />

![V](https://img.shields.io/npm/v/hamlet-builder) ![L](https://img.shields.io/npm/l/hamlet-builder)


This package makes it easy to build a Blogger Template. It is used to build the Blogger template [Hamlet](https://github.com/zkreations/hamlet/), and all Blogger themes derived from it.

## Features

- Use Handlebars to compile HBS and XML files
- Use Rollup to bundle JS files
- Use PostCSS to process CSS files
- Minify CSS and JS files using LightningCSS and Terser (Can be disabled)
- You can use the Blogger language with some additional facilities
- You can use configuration files to customize the build process (Optional)
- Fast and easy to use

## Install

```bash
npm install hamlet-builder
```

## Flags

| Flag              | Short Flag | Description                         | Default |
| ----------------- | ---------- | ----------------------------------- | ------- |
| `--input`         | `-i`       | Input path                          | `src`   |
| `--output`        | `-o`       | Output path                         | `dist`  |
| `--mode`          | `-m`       | Set mode: development or production | `development` |
| `--watch`         | `-w`       | Watches the source files and rebuilds on changes |  |
| `--no-minify`     | `-n`       | Disable minify CSS and JS files     |  |
| `--no-minify-css` | `-c`       | Disable minify CSS files           |  |
| `--no-minify-js`  | `-j`       | Disable minify JS files            |  |

## Usage

Add some scripts to your `package.json`, a good way to do it is the following:

```json
{
  "scripts": {
    "dev": "hamlet --mode development --watch",
    "start": "hamlet --mode production --watch",
    "build": "hamlet --mode production"
  }
}
```

Then you can run the following commands:

```bash
npm run start
npm run build
```

## Configuration Files

### Rollup

Add a `.rolluprc.js`, `rollup.config.js` or create a folder `.config` with a file `rolluprc.js`. You can also use the extension `.cjs` or `.mjs`. Here is an example of configuration:

```js
import terser from "@rollup/plugin-terser"

export default {
  plugins: [
    terser()
  ]
}
```

> [!NOTE]
> The `babel` plugins are used by default if a configuration file is not specified.

### PostCSS

Add a `.postcssrc.js`, `postcss.config.js` or create a folder `.config` with a file `postcssrc.js`. You can also use the extension `.cjs` or `.mjs`. Here is an example of configuration:

```js
import cssnanoPlugin from "cssnano"
import autoprefixer from "autoprefixer"

export default {
  plugins: [
    autoprefixer(),
    cssnanoPlugin()
  ]
}
```

> [!NOTE]
> The `autoprefixer` plugin is used by default if a configuration file is not specified.

### Handlebars

Add a `.handlebarsrc.js`, `handlebars.config.js` or create a folder `.config` with a file `handlebarsrc.js`. You can also use the extension `.cjs` or `.mjs`. The file defines the helpers that will be used in the templates. Here is an example of configuration:

```js
const sayHello = (name) => {
  return `Hello, ${name}!`
}

export default {
  helpers: {
    sayHello
  }
}
```

Use the helper in the template:

```handlebars
{{foo}}
```

> [!NOTE]
> The helpers `asset` and `currentYear` are always available, even if a configuration file exists, but they can be replaced if they are specified again.

### Theme

Add a `.themerc`, `.themerc.json`, `theme.config.json` or create a folder `.config` with a file `themerc.json`. Also you can add the information in the `package.json` file using the `theme` key. Here is an example of configuration:

```json
{
  "theme": {
    "name": "Hamlet",
    "author": "zkreations"
  }
}
```

The data will be the context of the Handlebars templates, so you can access them as follows:

```handlebars
{{name}}
{{author}}
```

### Browserlist

Add a `.browserslistrc` or add the information in the `package.json` file using the `browserslist` key. Here is an example of configuration:

```json
{
  "browserslist": [
    "last 2 versions",
    "not dead"
  ]
}
```

More information about the Browserslist configuration, check the [Browserslist repository](https://github.com/browserslist/browserslist).


## Structure

The user is free to organize the files and folders as they wish, as the system will search for `scss`, `sass`, `css`, `js`, `hbs` and `xml` files to compile them as needed.


### Compile styles

The system will search for `sass`, `scss` and `css` files to compile them. If the file name starts with an underscore `_`, it will be considered a partial file, for example:

```bash
├── src
│   ├── scss
│   │   ├── _module.scss
│   │   └── main.scss
```

Another example with `css` files:

```bash
├── src
│   ├── css
│   │   ├── _module.css
│   │   └── main.css
```

The file `main.scss` or `main.css` will be the main file that will be compiled and saved in the default output folder or the one specified by the user.


> [!TIP]
> The PostCSS plugins will also be applied to the `sass` and `scss` files after being compiled.


### Compile scripts

The system will search for `js` files, however only those that end with `bundle.js` will be considered as main files, for example:

```bash
├── src
│   ├── js
│   │   ├── module.js
│   │   └── main.bundle.js
```

The file `main.bundle.js` will be the main file, while the other files will be considered as modules. Also, when the main file is compiled, "bundle" is removed from the file name, so the resulting file will be `main.js`.

> [!NOTE]
> The name of the main file will be used as the name of the function generated by Rollup.


### Compile templates

The system will search for `hbs` and `xml` files to compile them. If the file name starts with an underscore `_`, it will be considered a partial file, for example:

```bash
├── src
│   ├── templates
│   │   ├── _module.hbs
│   │   └── main.hbs
```

Another example with `xml` files:

```bash
├── src
│   ├── templates
│   │   ├── _module.xml
│   │   └── main.xml
```

The file `main.hbs` or `main.xml` will be the main file that will be compiled and saved in the default output folder or the one specified by the user.

You can create any number of partials and organize them as you wish, just make sure to use unique names, when a partial is repeated you will receive a warning message. To include a partial use the following syntax:

```handlebars
{{> module}}
```

> [!TIP]
> If you have a folder with partials that you frequently create or delete, and they are also called together in a main file, you can use the `folder.` prefix to include all the partials from that folder, for example: `{{> folder.FOLDER_NAME}}`

#### Helpers

These helpers are defined by default in the system, and you can use them in your templates or override them in the Handlebars configuration file:

| Helper | Description |
| ------ | ----------- |
| `asset` | Include the content of the file in the template |
| `currentYear` | Include the current year |

Example of use the `asset` helper:

```handlebars
{{asset "dist/css/main.css"}}
{{asset "dist/js/main.js"}}
```

If the file is in the `node_modules` folder, you can omit the folder and use `~` to reference it:

```handlebars
{{asset "~/tooltips/main.css"}}
```

> [!IMPORTANT]
> Remember to use the `<style>` and `<script>` tags to include the CSS and JS files in your template.

Example of use the `currentYear` helper:

```handlebars
{{currentYear}}
```

#### Partials

There are predefined partials that you can use in your templates. These are identified with the prefix `super.`, for example:

| Partial | Description |
| ------- | ----------- |
| `super.defaultmarkups` | Clean and include the default widgets of Blogger |
| `super.ads` | Function: Create adsense ads |
| `super.adsense` | Function: AdSense async script |
| `super.attr` | Function: Add or remove multiple attributes |
| `super.avatar` | Function: Replace the default avatar image with a custom image |
| `super.image` | Function: Create custom image tag |
| `super.kind` | Function: add classes to body tag based on the current view |
| `super.menu` | Function: Create a menu from a list of links |
| `super.meta` | Function: Generate meta tags |
| `super.picture` | Function: Create custom picture tag |
| `super.snippet` | Function: Create a snippet of a string |
| `super.functions` | Include all functions partials |

To include a partial use the following syntax:

```handlebars
{{> super.defaultmarkups}}
```

## Additional features

When writing your templates, you will be able to use the Blogger language you already know, with some additional facilities.


### Root

You don't need to add the attributes to the root tag:

```xml
<html class='test'>
```

The above will compile to:

```xml
<html class='test' b:css='false' b:js='false' b:defaultwidgetversion='2' b:layoutsVersion='3' expr:dir='data:blog.languageDirection' expr:lang='data:blog.locale'>
```

### Variables

You can define variables with only the `name` attribute:

```xml
<Variable name="test"/>
<Variable name="example" value="false"/>
```

The above will compile to:

```xml
<Variable name='test' description='test' type='string'/>
<Variable name='example' description='example' type='string' value='false'/>
```

### Widgets

In the case of the `widget` tags, no attribute is required, you only need the type:

```xml
<b:widget/>
<b:widget type='PopularPosts'/>
<b:widget type='Label'/>
<b:widget type='Label'/>
```

The above will compile to:

```xml
<b:widget id='HTML1' type='HTML' version='2'/>
<b:widget id='PopularPosts1' type='PopularPosts' version='2'/>
<b:widget id='Label1' type='Label' version='2'/>
<b:widget id='Label2' type='Label' version='2'/>
```

> [!NOTE]
> When `type` is not specified, or if the specified type is not valid, `HTML` will be used by default.


### Normalize spaces

When you use `b:*` tags you can use spaces or line breaks to improve the clarity of your code, when it is compiled, these spaces will be normalized.

```xml
<b:include name='@image' data='{
  src: data:sourceUrl,
  resize: (data:shrinkToFit
    ? 500
    : 1280)
}'/>
```

The above will compile to:

```xml
<b:include name='@image' data='{ src: data:sourceUrl, resize: (data:shrinkToFit ? 500 : 1280) }'/>
```

## Create your beautiful theme

If you used this repository as a template, please, add a star ⭐ and add the following tags in yours:

- `blogger-hamlet`
- `blogger-handlebars`
- `blogger-hbs`

Thanks for using this repository. Happy coding! 🐋

## Supporting

If you want to help me keep this and more related projects always up to date, you can [buy me a coffee](https://ko-fi.com/zkreations) ☕. I will be very grateful 👏.

## License

**Hamlet-builder** is licensed under the MIT License


