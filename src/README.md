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

> This partial does not accept any parameters.

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
<b:include data='{["id","foo"],["class","foo"]}' name='@attr'/>
```

#### References

- [zkreations: Add or remove multiple attributes in one line](https://www.zkreations.com/2023/04/agrega-multiples-atributos-en-una-sola.html)
