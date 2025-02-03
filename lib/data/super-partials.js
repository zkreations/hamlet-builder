// Default partials
// @return {Object} - Default Partials
export const superPartials = {
  defaultmarkups: "{{#each defaultmarkups}}\n<b:defaultmarkup type='{{@key}}'>\n  {{#each this}}\n  <b:includable id='{{this}}'/>\n  {{/each}}\n</b:defaultmarkup>\n{{/each}}"
}
