# Partials

> This document explains the different types of partials that can be used in the project.

## Functions

The functions are Blogger inclusions that can be used anywhere in the theme and perform a task that is usually repetitive. These inclusions are created to avoid code repetition and facilitate theme maintenance.

> [!NOTE]
> If a parameter is mandatory, it is indicated with an asterisk (*).

### @ads

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

### @adsense

Includes the Adsense async script in the head of the page.

#### Parameters

> This partial does not accept any parameters.

#### Include partial

```hbs
{{> super.adsense}}
```

#### Usage example

```xml
<b:include name='@adsense'/>
```

