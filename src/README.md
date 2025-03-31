# Functions

The functions are Blogger inclusions that can be used anywhere in the theme and perform a task that is usually repetitive. These inclusions are created to avoid code repetition and facilitate theme maintenance.

> [!NOTE]
> If a parameter is mandatory, it is indicated with an asterisk (*).

## @ads

Used to create an Adsense ad block.

#### Parameters

| Name | Type | Description | Default Value |
|--------|------|-------------|------------------|
| `adClientId` | string | Adsense client ID. | `data:blog.adsenseClientId` |
| `style` | string | Inline style for the ad block. | `display: block` |
| `slot` | string | ID of the ad block created in Adsense. | - |
| `layout` | string | ID of the layout (in-feed & in-article ads). | - |

#### Include partial

```hbs
{{> super.ads}}
```

#### Usage example

```xml
<b:include name='@ads' data='{ layout: "in-feed" }'/>
```

## @adsense

Includes the Adsense async script in the head of the page.

#### Parameters

> This includable does not accept any parameters.

#### Include partial

```hbs
{{> super.adsense}}
```

#### Usage example

```xml
<b:include name='@adsense'/>
```

## @attr

Used to add or remove multiple attributes from an element. Every array must have two elements, the first is the name of the attribute and the second is the value. When the second element is not specified, the attribute named in the first element will be removed.

#### Parameters

| Name | Type | Description | Default Value |
|--------|------|-------------|------------------|
| `data` | array | Array of attributes to add or remove. | - |

#### Include partial

```hbs
{{> super.attr}}
```

#### Usage example

```xml
<b:include name='@attr' data='{["id","foo"],["class","foo"]}'/>
```

#### References

- [zkreations: Add or remove multiple attributes in one line.](https://www.zkreations.com/2023/04/agrega-multiples-atributos-en-una-sola.html)

## @avatar

Create the avatar format with any image, and also set a default image different from the one provided by Blogger.

#### Parameters

| Name | Type | Description | Default Value |
|--------|------|-------------|------------------|
| `src` | string | Avatar image URL. | - |
| `default` | string | Default image URL. | [default-user](https://lh3.googleusercontent.com/a/default-user) |
| `resize` | number | Resize image to a specific size. | 40 |
| `alt` | string | Alt text for the image. | `data:messages.image` |
| `class` | string | Additional classes for the image. | - |
| `loading` | string | Loading attribute for the image. | - |

#### Include partial

```hbs
{{> super.avatar}}
```

#### Usage example

```xml
 <b:include name='@avatar' data='{ src: data:post.author.authorPhoto.image }'/>
```

#### References

- [zkreations: Generate avatars from an image.](https://www.zkreations.com/2025/03/genera-avatares-partir-de-una-imagen.html)


## @image

Insert a custom image tag. It accepts image parameters along with other HTML attributes.

#### Parameters

| Name | Type | Description | Default Value |
|--------|------|-------------|------------------|
| `src` | string | Image URL. | - |
| `alt` | string | Alt text for the image. | `data:messages.image` |
| `id` | string | Unique ID for the image. | - |
| `class` | string | Additional classes for the image. | - |
| `width` | string | Image width. | - |
| `height` | string | Image height. | - |
| `resize` | number | Resize image to a specific size. | - |
| `ratio` | string | Aspect ratio for the image. | - |
| `sizes` | string | Sizes attribute value. | - |
| `srcset` | array | Array of dimensions for the image. | - |
| `loading` | string | Loading attribute for the image. | - |
| `params` | string | Additional [Google image parameters](https://www.zkreations.com/image-params). | - |

#### Include partial

```hbs
{{> super.image}}
```
#### Usage example

```xml
<b:include name='@image' data='{ src: data:view.featuredImage }'/>
```

#### References

- [zkreations: Manipulate images in Blogger easily](https://www.zkreations.com/2023/09/manipula-imagenes-en-blogger-facilmente.html)

## @kind

Used to add classes to the body tag based on the current view.

#### Parameters

> This includable does not accept any parameters.

#### Include partial

```hbs
{{> super.kind}}
```

#### Usage example

```xml
<b:include name='@kind'/>
```

## @menu

Create a list of links using a PageList widget link list

#### Parameters

| Name | Type | Description | Default Value |
|--------|------|-------------|------------------|
| `links` | array | Array of links. | - |
| `prefix` | string | Prefix for filter links. | `__` |
| `class` | string | Class for the menu. | - |
| `id` | string | Id for the menu. | - |

#### Include partial

```hbs
{{> super.menu}}
```

#### Usage example

```xml
<b:include name='@menu' data='{ links: data:links }'/>
```

#### References

- [zkreations: Dropdown menu with the links object](https://www.zkreations.com/2023/11/menu-desplegable-con-el-objeto-links.html)

## @meta

Creates the header metadata for the page, including favicons, description, canonical URL, robots, Open Graph, and Twitter tags. It's a modern replacement for Blogger's global inclusion `all-head-content`.

#### Parameters

| Name | Type | Description | Default Value |
|--------|------|-------------|------------------|
| `cardType` | string | Twitter card type. | `summary_large_image` |
| `forceHttps` | boolean | Force https on Canonicals URL. | - |
| `favicon` | string | URL of multiple resolutions favicon. | - |
| `favSizes` | array | Array of numbers/dimensions for favicons. | `[32,96,180,192]` |
| `robots` | string | Custom meta robots specifications. | `index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1` |
| `ogImage` | string | Default social networks image. | - |

#### Include partial

```hbs
{{> super.meta}}
```

#### Usage example

```xml
<b:include name='@meta' data='{ robots: "noindex,nofollow" }'/>
```

## @picture

Create a custom picture tag. It accepts image parameters along with other HTML attributes.

#### Parameters

| Name | Type | Description | Default Value |
|--------|------|-------------|------------------|
| `src` | string | Image URL. | - |
| `resizeSet` | array | Array of dimensions for the image. | `[700,400]` |
| `alt` | string | Alt text for the image. | `data:messages.image` |
| `id` | string | Unique ID for the image. | - |
| `class` | string | Additional classes for the image. | - |
| `width` | string | Image width. | - |
| `height` | string | Image height. | - |
| `ratio` | string | Aspect ratio for the image. | - |
| `loading` | string | Loading attribute for the image. | - |
| `params` | string | Additional [Google image parameters](https://www.zkreations.com/image-params). | - |

#### Include partial

```hbs
{{> super.picture}}
```

#### Usage example

```xml
<b:include name='@picture' data='{ src: data:view.featuredImage }'/>
```

#### References

- [zkreations: Generate responsive images with the picture tag](https://www.zkreations.com/2023/09/generar-imagenes-responsive-picture.html)

## @snippet

Creates a snippet of a string. It allows you to specify the length of the string, the HTML tag to be used, and whether to include ellipsis at the end.

#### Parameters

| Name | Type | Description | Default Value |
|--------|------|-------------|------------------|
| `string` | string | Text to be shortened. | - |
| `tag` | string | Container HTML tag. | `p` |
| `class` | string | Container class. | - |
| `id` | string | Container id. | - |
| `length` | number | Length of the string. | `70` |
| `ellipsis` | string | Ellipsis to be added at the end of the string. | `...` |

#### Include partial

```hbs
{{> super.snippet}}
```

#### Usage example

```xml
<b:include name='@snippet' data='{ string: data:post.snippets.long, length: 100 }'/>
```

#### References

- [zkreations: Create truncated text blocks in Blogger](https://www.zkreations.com/2025/03/crea-bloques-de-texto-truncados.html)

# Overrides

Overrides are Blogger inclusions that can be used in specific parts of the theme and serve to override inclusions that Blogger generates automatically.

## defaultmarkups

Genera una lista de inclusiones predeterminadas de Blogger y de todos sus widgets las cuales están cerradas. Al hacer esto, se evita que Blogger genere sus propias inclusiones.

#### Parameters

> This partial does not accept any parameters.

#### Include partial

```hbs
{{> super.defaultmarkups}}
```
#### Usage example

```hbs
<b:defaultmarkups>
  {{> super.defaultmarkups}}
</b:defaultmarkups>
```

> [!IMPORTANT]
> This partial must be included inside the `<b:defaultmarkups>` tag. Otherwise, it will not work.

