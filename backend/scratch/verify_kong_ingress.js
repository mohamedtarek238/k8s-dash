const assert = require('assert');

const BASE_URL = 'http://localhost:5100';

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data: json.data, meta: json.meta, error: json.error, message: json.message };
}

async function runVerification() {
  console.log('=== Starting Kong & Ingress Verification Suite ===\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return (async () => {
      try {
        await fn();
        console.log(`✅ PASS: ${name}`);
        passed++;
      } catch (err) {
        console.error(`❌ FAIL: ${name} ->`, err.message);
        failed++;
      }
    })();
  }

  // 1. Ingress Discovery
  await test('GET /api/ingresses returns list with count', async () => {
    const res = await get('/api/ingresses');
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.data), 'data should be an array');
    assert(res.meta && typeof res.meta.count === 'number', 'meta.count should be a number');
  });

  await test('GET /api/ingresses?namespace=default filters correctly', async () => {
    const res = await get('/api/ingresses?namespace=default');
    assert.strictEqual(res.status, 200);
    assert(res.data.every((i) => i.namespace === 'default'), 'All items should belong to default namespace');
  });

  await test('GET /api/ingresses?namespace=nonexistent-ns returns empty list', async () => {
    const res = await get('/api/ingresses?namespace=nonexistent-ns');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.length, 0);
  });

  // 2. Ingress Details & Controller Detection
  await test('GET /api/ingresses/default/test-dash-ingress returns full details and routing', async () => {
    const res = await get('/api/ingresses/default/test-dash-ingress');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.name, 'test-dash-ingress');
    assert(res.data.controller, 'controller info should be present');
    assert(res.data.routing, 'routing chain should be present');
    assert(res.data.kong, 'kong info should be present');
  });

  // 3. Gateway API HTTPRoutes (22 routes on this cluster)
  await test('GET /api/http-routes lists live Kong HTTPRoutes', async () => {
    const res = await get('/api/http-routes');
    assert.strictEqual(res.status, 200);
    assert(res.data.length >= 20, `Expected at least 20 HTTPRoutes, found ${res.data.length}`);
    const grafana = res.data.find((r) => r.name === 'grafana-route');
    assert(grafana, 'grafana-route should be present');
    assert.strictEqual(grafana.controller.type, 'kong', 'Controller should be detected as kong');
  });

  await test('GET /api/http-routes?namespace=kong-system filters by namespace', async () => {
    const res = await get('/api/http-routes?namespace=kong-system');
    assert.strictEqual(res.status, 200);
    assert(res.data.every((r) => r.namespace === 'kong-system'));
  });

  await test('GET /api/http-routes/kong-system/grafana-route resolves port-header KongPlugin and pods', async () => {
    const res = await get('/api/http-routes/kong-system/grafana-route');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.name, 'grafana-route');
    assert.strictEqual(res.data.controller.type, 'kong');
    assert(res.data.kong.resolvedPlugins.length > 0, 'Kong plugins should be resolved');
    const portHeader = res.data.kong.resolvedPlugins.find((p) => p.name === 'port-header');
    assert(portHeader && portHeader.resolved, 'port-header should be resolved');

    // Verify routing chain
    assert(res.data.routing, 'Routing chain should be populated');
    assert.strictEqual(res.data.routing.gateway.type, 'kong');
    assert(res.data.routing.backends.length > 0, 'Backends should be present');
    const monitoringBackend = res.data.routing.backends.find((b) => b.serviceName === 'grafana');
    assert(monitoringBackend, 'grafana backend service should be present');
    assert(monitoringBackend.totalPods > 0, 'Should have resolved at least 1 pod for grafana service');
  });

  // 4. Gateways
  await test('GET /api/gateways returns kong-gateway', async () => {
    const res = await get('/api/gateways');
    assert.strictEqual(res.status, 200);
    assert(res.data.length > 0);
    const kongGw = res.data.find((g) => g.name === 'kong-gateway');
    assert(kongGw, 'kong-gateway should be listed');
    assert.strictEqual(kongGw.gatewayClassName, 'kong-class');
  });

  await test('GET /api/gateways/kong-system/kong-gateway returns details', async () => {
    const res = await get('/api/gateways/kong-system/kong-gateway');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.name, 'kong-gateway');
    assert(res.data.listeners.length >= 2, 'Should have at least 2 listeners');
  });

  // 5. GatewayClasses
  await test('GET /api/gateway-classes returns kong-class', async () => {
    const res = await get('/api/gateway-classes');
    assert.strictEqual(res.status, 200);
    const kongClass = res.data.find((c) => c.name === 'kong-class');
    assert(kongClass, 'kong-class should be present');
  });

  await test('GET /api/gateway-classes/kong-class returns details', async () => {
    const res = await get('/api/gateway-classes/kong-class');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.name, 'kong-class');
    assert(res.data.controllerName.includes('kong'), 'controllerName should mention kong');
  });

  // 6. YAML Viewer for Ingress, HTTPRoute, Gateway, GatewayClass, KongPlugin
  await test('GET /api/ingresses/default/test-dash-ingress/yaml returns live Ingress YAML', async () => {
    const res = await get('/api/ingresses/default/test-dash-ingress/yaml');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.kind, 'Ingress');
    assert(res.data.yaml.includes('kind: Ingress'));
  });

  await test('GET /api/http-routes/kong-system/grafana-route/yaml returns live HTTPRoute YAML', async () => {
    const res = await get('/api/http-routes/kong-system/grafana-route/yaml');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.kind, 'HTTPRoute');
    assert(res.data.yaml.includes('kind: HTTPRoute'));
    assert(res.data.yaml.includes('grafana-route'));
  });

  await test('GET /api/resources/httproutes/kong-system/grafana-route/yaml (generic) works', async () => {
    const res = await get('/api/resources/httproutes/kong-system/grafana-route/yaml');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.kind, 'HTTPRoute');
  });

  await test('GET /api/resources/gateways/kong-system/kong-gateway/yaml (generic) works', async () => {
    const res = await get('/api/resources/gateways/kong-system/kong-gateway/yaml');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.kind, 'Gateway');
  });

  await test('GET /api/resources/gatewayclasses/kong-class/yaml (generic) works', async () => {
    const res = await get('/api/resources/gatewayclasses/kong-class/yaml');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.kind, 'GatewayClass');
  });

  await test('GET /api/resources/kongplugins/kong-system/port-header/yaml (generic) works', async () => {
    const res = await get('/api/resources/kongplugins/kong-system/port-header/yaml');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.kind, 'KongPlugin');
    assert(res.data.yaml.includes('kind: KongPlugin'));
  });

  // 7. Error Handling & Validation
  await test('GET /api/http-routes/default/nonexistent-route returns 404', async () => {
    const res = await get('/api/http-routes/default/nonexistent-route');
    assert.strictEqual(res.status, 404);
  });

  await test('GET /api/gateways/default/nonexistent-gw returns 404', async () => {
    const res = await get('/api/gateways/default/nonexistent-gw');
    assert.strictEqual(res.status, 404);
  });

  await test('GET /api/resources/invalid-resource-type/default/test/yaml returns 400', async () => {
    const res = await get('/api/resources/invalid-resource-type/default/test/yaml');
    assert.strictEqual(res.status, 400);
  });

  // 8. Kong Credential Sanitization Unit Check
  await test('sanitizeKongConfig redacts sensitive fields', async () => {
    const path = require('path');
    const { sanitizeKongConfig } = require(path.resolve(__dirname, '../src/services/kubernetes/kong.service'));
    const dirty = {
      username: 'admin',
      password: 'supersecretpassword',
      token: 'bearer-xyz',
      apiKey: 'key123',
      nested: {
        private_key: '-----BEGIN RSA PRIVATE KEY-----',
        safe_param: 'allow-all'
      }
    };
    const clean = sanitizeKongConfig(dirty);
    assert.strictEqual(clean.username, 'admin');
    assert.strictEqual(clean.password, '[REDACTED]');
    assert.strictEqual(clean.token, '[REDACTED]');
    assert.strictEqual(clean.apiKey, '[REDACTED]');
    assert.strictEqual(clean.nested.private_key, '[REDACTED]');
    assert.strictEqual(clean.nested.safe_param, 'allow-all');
  });

  console.log(`\n========================================`);
  console.log(`Tests finished: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification();
