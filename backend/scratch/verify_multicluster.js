require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const { createApp } = require('../src/app');
const { listClusters, getDefaultClusterId } = require('../src/config/kubernetes');
const assert = require('assert');

function makeRequest(server, path, options = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const req = http.request({
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let body;
        try {
          body = JSON.parse(data);
        } catch {
          body = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'object' ? JSON.stringify(options.body) : options.body);
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== Multi-Cluster Verification Test Suite ===\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return (async () => {
      try {
        await fn();
        console.log(`  [PASS] ${name}`);
        passed++;
      } catch (err) {
        console.error(`  [FAIL] ${name}`);
        console.error(`         ${err.message}`);
        failed++;
      }
    })();
  }

  const app = createApp();
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    // Test 1: Clusters endpoint
    await test('GET /api/clusters returns 200 with list of clusters', async () => {
      const res = await makeRequest(server, '/api/clusters');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length > 0);
    });

    // Test 2: Clusters data is sanitized (no secrets/tokens/keys)
    await test('GET /api/clusters does not leak sensitive credentials', async () => {
      const res = await makeRequest(server, '/api/clusters');
      const clusters = res.body.data;
      for (const c of clusters) {
        assert.ok(c.id, 'Cluster must have id');
        assert.ok(c.server, 'Cluster must have server URL');
        assert.strictEqual(c.token, undefined);
        assert.strictEqual(c.keyData, undefined);
        assert.strictEqual(c.certData, undefined);
        assert.strictEqual(c.kubeConfig, undefined);
        assert.strictEqual(c.clients, undefined);
      }
    });

    // Test 3: Get cluster by ID
    const defaultId = getDefaultClusterId();
    await test(`GET /api/clusters/${defaultId} returns cluster info`, async () => {
      const res = await makeRequest(server, `/api/clusters/${defaultId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.id, defaultId);
    });

    // Test 4: Get non-existent cluster returns 404
    await test('GET /api/clusters/non-existent-cluster-123 returns 404', async () => {
      const res = await makeRequest(server, '/api/clusters/non-existent-cluster-123');
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
    });

    // Test 5: Invalid cluster in ?cluster= query param returns 400
    await test('GET /api/nodes?cluster=non-existent-cluster-456 returns 400', async () => {
      const res = await makeRequest(server, '/api/nodes?cluster=non-existent-cluster-456');
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Unknown cluster'));
    });

    // Test 6: Default cluster works without ?cluster= query param (backward compat)
    await test('GET /api/status works without ?cluster= param', async () => {
      const res = await makeRequest(server, '/api/status');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    });

    // Test 7: GET /api/cluster works with default cluster
    await test('GET /api/cluster returns telemetry overview', async () => {
      const res = await makeRequest(server, '/api/cluster');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.server);
      assert.ok(res.body.data.context);
    });

    // Test 8: GET /api/cluster with explicit ?cluster=<defaultId>
    await test(`GET /api/cluster?cluster=${defaultId} matches default request`, async () => {
      const resExplicit = await makeRequest(server, `/api/cluster?cluster=${defaultId}`);
      assert.strictEqual(resExplicit.status, 200);
      assert.strictEqual(resExplicit.body.success, true);
    });

    // Test 9: Nodes endpoint with explicit cluster
    await test(`GET /api/nodes?cluster=${defaultId} returns nodes`, async () => {
      const res = await makeRequest(server, `/api/nodes?cluster=${defaultId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    // Test 10: Namespaces endpoint with explicit cluster
    await test(`GET /api/namespaces?cluster=${defaultId} returns namespaces`, async () => {
      const res = await makeRequest(server, `/api/namespaces?cluster=${defaultId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    // Test 11: Pods endpoint with explicit cluster
    await test(`GET /api/pods?cluster=${defaultId} returns pods`, async () => {
      const res = await makeRequest(server, `/api/pods?cluster=${defaultId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    // Test 12: Deployments endpoint with explicit cluster
    await test(`GET /api/deployments?cluster=${defaultId} returns deployments`, async () => {
      const res = await makeRequest(server, `/api/deployments?cluster=${defaultId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    // Test 13: Services endpoint with explicit cluster
    await test(`GET /api/services?cluster=${defaultId} returns services`, async () => {
      const res = await makeRequest(server, `/api/services?cluster=${defaultId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    // Test 14: Ingresses endpoint with explicit cluster
    await test(`GET /api/ingresses?cluster=${defaultId} returns ingresses`, async () => {
      const res = await makeRequest(server, `/api/ingresses?cluster=${defaultId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    // Test 15: HTTPRoutes endpoint with explicit cluster
    await test(`GET /api/http-routes?cluster=${defaultId} returns http routes`, async () => {
      const res = await makeRequest(server, `/api/http-routes?cluster=${defaultId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    // Test 16: Gateways endpoint with explicit cluster
    await test(`GET /api/gateways?cluster=${defaultId} returns gateways`, async () => {
      const res = await makeRequest(server, `/api/gateways?cluster=${defaultId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    // Test 17: Health endpoint with explicit cluster
    await test(`GET /api/health?cluster=${defaultId} returns cluster health`, async () => {
      const res = await makeRequest(server, `/api/health?cluster=${defaultId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(typeof res.body.data.score === 'number');
    });

    // Test 18: Troubleshooting endpoint with explicit cluster
    await test(`GET /api/troubleshooting?cluster=${defaultId} returns troubleshooting`, async () => {
      const res = await makeRequest(server, `/api/troubleshooting?cluster=${defaultId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    });

    // Test 19: YAML Viewer with cluster param
    await test(`GET /api/resources/namespaces/default/yaml?cluster=${defaultId} returns YAML`, async () => {
      const res = await makeRequest(server, `/api/resources/namespaces/default/yaml?cluster=${defaultId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.yaml.includes('kind: Namespace'));
    });

    // Test 20: Root / endpoint shows multi-cluster info
    await test('GET / returns context and cluster count', async () => {
      const res = await makeRequest(server, '/');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(typeof res.body.data.clusters === 'number');
    });

  } finally {
    server.close();
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running verification:', err);
  process.exit(1);
});
