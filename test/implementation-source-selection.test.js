const assert = require('node:assert/strict');
const {fixture, render} = require('./helpers/helm');

const cases = [
  ['charts/domain/environment', 'split-scm.yaml', '-systems', 'charts/system/environment'],
  ['charts/system/environment', 'nonstandard-lifecycle.yaml', '-components', 'charts/component/container'],
  ['charts/system/environment', 'nonstandard-lifecycle.yaml', '-api-builds', 'charts/api/openapi'],
  ['charts/system/environment', 'nonstandard-lifecycle.yaml', '-resources', '{{ .implementation.path }}'],
];

test.each(cases)('%s: renders default sources and optional implementation patch', (chart, fixtureName, suffix, defaultPath) => {
  const applicationSet = render(chart, fixture(fixtureName))
    .find(item => item.kind === 'ApplicationSet' && item.metadata.name.endsWith(suffix));
  assert.ok(applicationSet, `Missing ApplicationSet ${suffix}`);
  assert.equal(applicationSet.spec.template.spec.sources[0].path, defaultPath);
  assert.equal(applicationSet.spec.template.spec.sources.length, 2);
  assert.match(applicationSet.spec.templatePatch, /dig "implementation" "source"/);
  assert.match(applicationSet.spec.templatePatch, /sources:.*list .*toJson/);
});

test('platform trusted sources extend Domain and System AppProjects', () => {
  const custom = 'https://github.com/example-org/trusted-implementation.git';
  const domain = fixture('split-scm.yaml');
  domain.spec.platform.argocd.additionalTrustedSources = [custom];
  const domainResources = render('charts/domain/environment', domain);
  const domainProject = domainResources.find(item => item.kind === 'AppProject' && item.metadata.name === 'tenant-retail');
  assert.deepEqual(domainProject.spec.sourceRepos, [
    'https://platform-gitea.example/platform-private/developer-charts.git',
    'https://tenant-gitea.example/retail-team/retail-domain.git',
    custom,
  ]);
  const systemSets = domainResources.filter(item => item.kind === 'ApplicationSet');
  for (const set of systemSets) {
    assert.deepEqual(set.spec.template.spec.sources[0].helm.valuesObject.delivery.additionalTrustedSources, [custom]);
  }

  const system = fixture('nonstandard-lifecycle.yaml');
  system.delivery.additionalTrustedSources = [custom];
  const systemResources = render('charts/system/environment', system);
  const systemProject = systemResources.find(item => item.kind === 'AppProject' && item.metadata.name === 'tenant-retail-orders');
  assert.deepEqual(systemProject.spec.sourceRepos, [
    'https://platform-gitea.example/platform-private/developer-charts.git',
    'https://tenant-gitea.example/retail-team/orders-system.git',
    custom,
  ]);
});
