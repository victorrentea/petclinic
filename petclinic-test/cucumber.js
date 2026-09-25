module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: ['src/support/world.ts', 'src/**/*.glue.ts'],
    paths: ['src/**/*.feature'],
    // @wip scenarios state rules that production code does not enforce yet.
    tags: 'not @wip',
    format: ['progress'],
    publishQuiet: true,
  },
};
