const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const auditService = require('../src/services/kubernetes/audit.service');

// Helper to create a temporary test directory
const testTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'k8s-audit-test-'));

console.log('--- Starting Kubernetes Audit Service Unit & Integration Tests ---');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✓ [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ [FAIL] Test ${totalTests}: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✓ [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ [FAIL] Test ${totalTests}: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

(async () => {
  // Sample valid audit event
  const sampleAuditEvent = {
    kind: 'Event',
    apiVersion: 'audit.k8s.io/v1',
    level: 'RequestResponse',
    auditID: 'test-audit-uuid-001',
    stage: 'ResponseComplete',
    requestURI: '/api/v1/namespaces/test-ns/pods?token=supersecret123',
    verb: 'create',
    user: {
      username: 'test-user-alice',
      groups: ['system:authenticated', 'developers'],
    },
    sourceIPs: ['192.168.1.50', '10.0.0.1'],
    userAgent: 'kubectl/v1.30.0',
    objectRef: {
      resource: 'pods',
      namespace: 'test-ns',
      name: 'nginx-pod-1',
      apiVersion: 'v1',
    },
    responseStatus: {
      code: 201,
      status: 'Success',
    },
    requestReceivedTimestamp: '2026-09-23T10:00:00.000000Z',
    stageTimestamp: '2026-09-23T10:00:00.050000Z',
  };

  // 1. Valid audit JSON normalization
  runTest('1. Valid audit JSON normalization', () => {
    const normalized = auditService.normalizeAuditEvent(sampleAuditEvent, 0);
    assert.strictEqual(normalized.auditID, 'test-audit-uuid-001');
    assert.strictEqual(normalized.user, 'test-user-alice');
    assert.strictEqual(normalized.verb, 'create');
    assert.strictEqual(normalized.resource, 'pods');
    assert.strictEqual(normalized.namespace, 'test-ns');
    assert.strictEqual(normalized.resourceName, 'nginx-pod-1');
    assert.strictEqual(normalized.statusCode, 201);
    assert.strictEqual(normalized.allowed, true);
    assert.strictEqual(normalized.status, 'allowed');
    assert.strictEqual(normalized.sourceIP, '192.168.1.50');
    assert.strictEqual(normalized.userAgent, 'kubectl/v1.30.0');
    assert.strictEqual(normalized.timestamp, '2026-09-23T10:00:00.050000Z');
  });

  // 2. Multiple JSON lines
  runTest('2. Multiple JSON lines reading and parsing', () => {
    const multiLineFile = path.join(testTmpDir, 'multiline.log');
    const ev2 = { ...sampleAuditEvent, auditID: 'test-audit-002', verb: 'delete', stageTimestamp: '2026-09-23T10:05:00.000000Z' };
    const content = JSON.stringify(sampleAuditEvent) + '\n' + JSON.stringify(ev2) + '\n';
    fs.writeFileSync(multiLineFile, content, 'utf-8');

    const events = auditService.readTailAuditRecords(multiLineFile, 1024 * 1024);
    assert.strictEqual(events.length, 2);
    // Newest first
    assert.strictEqual(events[0].auditID, 'test-audit-002');
    assert.strictEqual(events[1].auditID, 'test-audit-uuid-001');
  });

  // 3. Malformed line safely ignored
  runTest('3. Malformed line handling without failing request', () => {
    const malformedFile = path.join(testTmpDir, 'malformed.log');
    const content = 'NOT A VALID JSON LINE\n' +
      JSON.stringify(sampleAuditEvent) + '\n' +
      '{ corrupt json...\n' +
      JSON.stringify({ ...sampleAuditEvent, auditID: 'test-audit-003' }) + '\n';
    fs.writeFileSync(malformedFile, content, 'utf-8');

    const events = auditService.readTailAuditRecords(malformedFile, 1024 * 1024);
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events.some((e) => e.auditID === 'test-audit-uuid-001'), true);
    assert.strictEqual(events.some((e) => e.auditID === 'test-audit-003'), true);
  });

  // 4. Empty file
  await runAsyncTest('4. Empty file returns capability reason EMPTY_LOG', async () => {
    const emptyFile = path.join(testTmpDir, 'empty.log');
    fs.writeFileSync(emptyFile, '', 'utf-8');

    process.env.KUBERNETES_AUDIT_LOG_PATH_KUBERNETES_ADMIN_KUBERNETES = emptyFile;
    process.env.KUBERNETES_AUDIT_LOG_PATH = emptyFile;
    const status = await auditService.getAuditStatus();
    assert.strictEqual(status.configured, true);
    assert.strictEqual(status.readable, true);
    assert.strictEqual(status.recordsDetected, 0);
    assert.strictEqual(status.reason, auditService.AUDIT_REASONS.EMPTY_LOG);

    const result = await auditService.getAuditEvents();
    assert.strictEqual(result.available, true);
    assert.strictEqual(result.total, 0);
    assert.deepStrictEqual(result.events, []);
  });

  // 5. Missing file
  await runAsyncTest('5. Missing file returns capability reason FILE_NOT_FOUND', async () => {
    process.env.KUBERNETES_AUDIT_LOG_PATH_KUBERNETES_ADMIN_KUBERNETES = path.join(testTmpDir, 'does-not-exist.log');
    process.env.KUBERNETES_AUDIT_LOG_PATH = path.join(testTmpDir, 'does-not-exist.log');
    const status = await auditService.getAuditStatus();
    assert.strictEqual(status.available, false);
    assert.strictEqual(status.reason, auditService.AUDIT_REASONS.FILE_NOT_FOUND);

    const result = await auditService.getAuditEvents();
    assert.strictEqual(result.available, false);
    assert.strictEqual(result.reason, auditService.AUDIT_REASONS.FILE_NOT_FOUND);
  });

  // 6. Permission denied simulation
  runTest('6. Permission denied capability check', () => {
    // Test inspectAuditCapability handles non-readable path simulation
    const originalAccessSync = fs.accessSync;
    try {
      const dummyFile = path.join(testTmpDir, 'perm-test.log');
      fs.writeFileSync(dummyFile, 'data', 'utf-8');
      process.env.KUBERNETES_AUDIT_LOG_PATH_KUBERNETES_ADMIN_KUBERNETES = dummyFile;
      process.env.KUBERNETES_AUDIT_LOG_PATH = dummyFile;

      fs.accessSync = () => {
        const err = new Error('EACCES: permission denied');
        err.code = 'EACCES';
        throw err;
      };

      const capability = auditService.inspectAuditCapability();
      assert.strictEqual(capability.available, false);
      assert.strictEqual(capability.reason, auditService.AUDIT_REASONS.PERMISSION_DENIED);
    } finally {
      fs.accessSync = originalAccessSync;
    }
  });

  // Create a populated log file for filter tests
  const testLogFile = path.join(testTmpDir, 'filter_test.log');
  const dataset = [
    { ...sampleAuditEvent, auditID: 'ev-1', verb: 'create', objectRef: { ...sampleAuditEvent.objectRef, namespace: 'prod' }, user: { username: 'alice' } },
    { ...sampleAuditEvent, auditID: 'ev-2', verb: 'delete', objectRef: { ...sampleAuditEvent.objectRef, namespace: 'prod' }, user: { username: 'alice' } },
    { ...sampleAuditEvent, auditID: 'ev-3', verb: 'get', objectRef: { ...sampleAuditEvent.objectRef, namespace: 'kube-system' }, user: { username: 'bob' } },
    {
      ...sampleAuditEvent,
      auditID: 'ev-4',
      verb: 'patch',
      objectRef: { ...sampleAuditEvent.objectRef, namespace: 'default' },
      user: { username: 'charlie' },
      responseStatus: { code: 403, status: 'Failure', reason: 'Forbidden' },
    },
    { ...sampleAuditEvent, auditID: 'ev-5', verb: 'create', objectRef: { ...sampleAuditEvent.objectRef, namespace: 'default' }, user: { username: 'alice' } },
  ];
  fs.writeFileSync(testLogFile, dataset.map((d) => JSON.stringify(d)).join('\n') + '\n', 'utf-8');
  process.env.KUBERNETES_AUDIT_LOG_PATH_KUBERNETES_ADMIN_KUBERNETES = testLogFile;
  process.env.KUBERNETES_AUDIT_LOG_PATH = testLogFile;

  // 7. Filtering by namespace
  await runAsyncTest('7. Filtering by namespace', async () => {
    const res = await auditService.getAuditEvents(null, { namespace: 'prod' });
    assert.strictEqual(res.available, true);
    assert.strictEqual(res.events.length, 2);
    assert.strictEqual(res.events.every((e) => e.namespace === 'prod'), true);
  });

  // 8. Filtering by verb
  await runAsyncTest('8. Filtering by verb', async () => {
    const res = await auditService.getAuditEvents(null, { verb: 'create' });
    assert.strictEqual(res.available, true);
    assert.strictEqual(res.events.length, 2);
    assert.strictEqual(res.events.every((e) => e.verb === 'create'), true);
  });

  // 9. Filtering by user
  await runAsyncTest('9. Filtering by user', async () => {
    const res = await auditService.getAuditEvents(null, { user: 'alice' });
    assert.strictEqual(res.available, true);
    assert.strictEqual(res.events.length, 3);
    assert.strictEqual(res.events.every((e) => e.user === 'alice'), true);
  });

  // 10. Filtering by status
  await runAsyncTest('10. Filtering by status (allowed and denied)', async () => {
    const resDenied = await auditService.getAuditEvents(null, { status: 'denied' });
    assert.strictEqual(resDenied.available, true);
    assert.strictEqual(resDenied.events.length, 1);
    assert.strictEqual(resDenied.events[0].auditID, 'ev-4');
    assert.strictEqual(resDenied.events[0].allowed, false);
    assert.strictEqual(resDenied.events[0].statusCode, 403);

    const resAllowed = await auditService.getAuditEvents(null, { status: 'allowed' });
    assert.strictEqual(resAllowed.available, true);
    assert.strictEqual(resAllowed.events.length, 4);
    assert.strictEqual(resAllowed.events.every((e) => e.allowed === true), true);
  });

  // 11. Pagination/limit
  await runAsyncTest('11. Pagination / limit / offset', async () => {
    const resPage1 = await auditService.getAuditEvents(null, { limit: 2, offset: 0 });
    assert.strictEqual(resPage1.events.length, 2);
    assert.strictEqual(resPage1.total, 5);

    const resPage2 = await auditService.getAuditEvents(null, { limit: 2, offset: 2 });
    assert.strictEqual(resPage2.events.length, 2);
    assert.notStrictEqual(resPage1.events[0].auditID, resPage2.events[0].auditID);
  });

  // 12. Sensitive field sanitization
  runTest('12. Sensitive field sanitization', () => {
    const sensitiveEvent = {
      requestURI: '/api/v1/namespaces/test/secrets?token=myBearerSecret123&password=secretpass&key=privkey',
      headers: {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token',
      },
      annotations: {
        'client-key-data': 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCg==',
        'auth.token': 'very-confidential-token',
        'safe-key': 'normal-value',
      },
    };

    const sanitized = auditService.sanitizeSensitiveData(sensitiveEvent);
    assert.strictEqual(sanitized.requestURI.includes('myBearerSecret123'), false);
    assert.strictEqual(sanitized.requestURI.includes('[REDACTED]'), true);
    assert.strictEqual(sanitized.headers.authorization.includes('eyJhbGci'), false);
    assert.strictEqual(sanitized.headers.authorization.includes('[REDACTED]'), true);
    assert.strictEqual(sanitized.annotations['client-key-data'], '[REDACTED]');
    assert.strictEqual(sanitized.annotations['auth.token'], '[REDACTED]');
    assert.strictEqual(sanitized.annotations['safe-key'], 'normal-value');
  });

  // Multi-cluster tests
  const cluster1File = path.join(testTmpDir, 'c1.log');
  const cluster2File = path.join(testTmpDir, 'c2.log');
  fs.writeFileSync(cluster1File, JSON.stringify({
    kind: 'Event',
    apiVersion: 'audit.k8s.io/v1',
    auditID: 'c1-event-01',
    verb: 'create',
    user: { username: 'c1-admin' },
    objectRef: { resource: 'pods', namespace: 'default' },
  }) + '\n');
  fs.writeFileSync(cluster2File, JSON.stringify({
    kind: 'Event',
    apiVersion: 'audit.k8s.io/v1',
    auditID: 'c2-event-01',
    verb: 'delete',
    user: { username: 'c2-admin' },
    objectRef: { resource: 'deployments', namespace: 'prod' },
  }) + '\n');

  process.env.KUBERNETES_AUDIT_LOG_PATH_KUBERNETES_ADMIN_KUBERNETES = cluster1File;
  process.env.KUBERNETES_AUDIT_LOG_PATH_KUBERNETES_ADMIN_KUBERNETES_2 = cluster2File;
  delete process.env.KUBERNETES_AUDIT_LOG_PATH_KUBERNETES_ADMIN_KUBERNETES_3;

  await runAsyncTest('13. Multi-cluster: cluster 1 queries its own audit source', async () => {
    const res = await auditService.getAuditEvents('kubernetes-admin-kubernetes');
    assert.strictEqual(res.available, true);
    assert.strictEqual(res.events.length, 1);
    assert.strictEqual(res.events[0].user, 'c1-admin');
    assert.strictEqual(res.events[0].resource, 'pods');
  });

  await runAsyncTest('14. Multi-cluster: cluster 2 queries its own distinct source', async () => {
    const res = await auditService.getAuditEvents('kubernetes-admin-kubernetes-2');
    assert.strictEqual(res.available, true);
    assert.strictEqual(res.events.length, 1);
    assert.strictEqual(res.events[0].user, 'c2-admin');
    assert.strictEqual(res.events[0].resource, 'deployments');
  });

  await runAsyncTest('15. Multi-cluster: unconfigured cluster returns available: false and NOT_CONFIGURED', async () => {
    const res = await auditService.getAuditEvents('kubernetes-admin-kubernetes-3');
    assert.strictEqual(res.available, false);
    assert.strictEqual(res.reason, 'NOT_CONFIGURED');
    assert.strictEqual(res.events.length, 0);
  });

  await runAsyncTest('16. Multi-cluster: unrecognized cluster returns CLUSTER_NOT_SUPPORTED', async () => {
    const res = await auditService.getAuditEvents('unknown-cluster-xyz');
    assert.strictEqual(res.available, false);
    assert.strictEqual(res.reason, 'CLUSTER_NOT_SUPPORTED');
  });

  // Clean up tmp directory
  try {
    fs.rmSync(testTmpDir, { recursive: true, force: true });
  } catch (err) {}

  console.log(`\n========================================`);
  console.log(`Results: ${passedTests}/${totalTests} Tests Passed`);
  console.log(`========================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
})();
