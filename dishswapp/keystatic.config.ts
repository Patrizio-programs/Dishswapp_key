
import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: {
  kind: 'github',
  repo: {
    owner: 'Patrizio-programs',
    name: 'Dishswapp_key',
  },
  pathPrefix: 'dishswapp',
},
  collections: {
    posts: collection({
      label: 'Posts',
      slugField: 'title',
      path: 'src/content/posts/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        content: fields.markdoc({
          label: 'Content',
          options: {
            image: {
              directory: 'src/assets/images/posts',
              publicPath: '../../assets/images/posts/',
            },
          },
        }),
      },
    }),

    recipes: collection({
      label: 'Recipes',
      slugField: 'title',
      path: 'src/content/recipes/*',
      columns: ['title', 'difficulty'],
      schema: {
        title: fields.slug({
          name: { label: 'Recipe title' },
          validation: { isRequired: true },
        }),

        ingredients: fields.array(
          fields.text({ label: 'Ingredient' }),
          {
            label: 'Ingredients',
            itemLabel: props => props.value || 'New ingredient',
          }
        ),

        instructions: fields.array(
          fields.text({
            label: 'Step',
            multiline: true,
          }),
          {
            label: 'Instructions',
            itemLabel: props => props.value || 'New step',
          }
        ),

        tags: fields.array(
          fields.text({ label: 'Tag' }),
          {
            label: 'Tags',
            itemLabel: props => props.value || 'New tag',
          }
        ),

        difficulty: fields.select({
  label: 'Difficulty',
  options: [
    { label: 'Not specified', value: 'none' },
    { label: 'Easy', value: 'easy' },
    { label: 'Intermediate', value: 'intermediate' },
    { label: 'Hard', value: 'hard' },
  ],
  defaultValue: 'none',
}),

        description: fields.text({
          label: 'Description',
          multiline: true,
        }),

        author: fields.text({ label: 'Author' }),

        image: fields.image({
          label: 'Recipe image',
          directory: 'public/images/recipes',
          publicPath: '/images/recipes/',
        }),

        prepTime: fields.integer({
          label: 'Preparation time (minutes)',
        }),

        cookTime: fields.integer({
          label: 'Cooking time (minutes)',
        }),

        servings: fields.integer({
          label: 'Servings',
        }),

        notes: fields.text({
          label: 'Additional notes',
          multiline: true,
        }),
      },
    }),
  },
});
