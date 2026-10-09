# Domain chart

Discovers the Systems active across every ordered Domain environment in one Helm render.

The chart reads tenant identity and lifecycle policy from the Domain catalog entity, and trusted
Argo CD, router-domain, chart, Schema Registry, Quay, and build configuration from `spec.platform`.
It creates one Domain AppProject and one System-discovery ApplicationSet per ordered environment.
Each ApplicationSet watches `systems/*/environments/<environment>.yaml`; a missing activation file
means that System is inactive in that environment.

### System implementation selection

The System environment registration may include optional `implementation.source` to select a
custom Git reconciliation source in place of `charts/system/environment`:

```yaml
systemName: example-system
implementation:
  source:
    repoURL: https://github.com/example-org/example-system.git
    targetRevision: main
    path: gitops/system
```

Without this block, generated System Applications continue using the platform's default System
chart and its supplied values. With the block, the ApplicationSet patches the `sources` list to
one custom Git source. It preserves the generated Application name, Domain AppProject, destination,
and sync policy. The custom source does not inherit the default chart's Helm values or its additional
values repository. Source repositories and managed resources must be authorized by the Domain
AppProject. The chart does not add trust permissions for custom sources. See
[implementation selection](../../../docs/architecture.md#selecting-an-alternative-implementation).

By default, Domain admission provisions publisher identities. To admit a Domain without managing publisher clients, set `spec.platform.security.publisherIdentity.enabled: false` in the **trusted platform target**. This omits all publisher-identity resources while retaining the Domain AppProject and System discovery ApplicationSets. Publisher credentials/roles must then be supplied separately when needed. The default is enabled, preserving existing installations.

The same Domain Application owns its privileged publisher boundary without creating a separate
security Application: distinct Apicurio/Microcks Password generators, canonical Secrets,
same-namespace Keycloak projections and `KeycloakOIDCClient` resources, exact-name get-only RBAC,
and conditioned SecretStores. The admitted Domain name determines every privileged name and
selector. Only the selected build namespace can consume the generic local publisher Secrets.

Required values are `metadata`, `spec.platformTarget`, `spec.groupId`, `spec.environments`, and
`spec.platform`. Domain definitions own only `namespaceSuffix`. The chart synthesizes the current
System-chart environment contract by combining those suffixes with
`spec.platform.cluster.routerDomain`.

The build environment must exist, be ordered, and be first. All ordered environments must have
valid definitions. Removing an environment removes only its ApplicationSet through normal Argo CD
pruning.

Tenant annotations locate the Domain repository. `spec.platform.charts.repositoryUrl` and `revision`
locate the trusted chart repository directly. `spec.platform.schemaRegistry`,
`spec.platform.registry`, and `spec.platform.build` pass target-owned runtime policy downstream.

Generated System values use `group:default/domain-maintainers` for tenant ownership. The chart does
not derive per-Domain Backstage group names.

```bash
helm lint charts/domain/environment
helm template tenant-domain charts/domain/environment \
  -f /path/to/merged-domain-and-target-values.yaml
```


### Trusted implementation repositories

The platform target can extend the Domain AppProject source allowlist using
`spec.platform.argocd.additionalTrustedSources`. Entries are additive to the chart and Domain
repository defaults and are controlled by platform configuration, not System registrations.
Authorization to use a repository does not expand the allowed resource kinds or destinations.
