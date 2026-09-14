const assert = require('assert');
const path = require('path');

// 1. Load backend helper
const {
  formatMemoryQuantity: backendFormatMemory,
  parseQuantityToBytes: backendParseQuantity,
} = require('../src/utils/k8sHelpers');

async function runTests() {
  console.log('=== Starting Memory Capacity Formatter Verification Suite ===\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  // Also import frontend formatter (ESM via dynamic import)
  const frontendPath = path.resolve(__dirname, '../frontend/src/formatters.js');
  const frontendModule = await import('file://' + frontendPath.replace(/\\/g, '/'));
  const frontendFormatMemory = frontendModule.formatMemoryQuantity;
  const frontendParseQuantity = frontendModule.parseQuantityToBytes;

  const formatters = [
    { name: 'Frontend (formatters.js)', format: frontendFormatMemory, parse: frontendParseQuantity },
    { name: 'Backend (k8sHelpers.js)', format: backendFormatMemory, parse: backendParseQuantity },
  ];

  for (const { name: fName, format, parse } of formatters) {
    console.log(`--- Testing ${fName} ---`);

    // 1. Actual cluster values
    test(`${fName}: 8127828Ki -> 7.75 GiB`, () => {
      assert.strictEqual(format('8127828Ki'), '7.75 GiB');
    });

    test(`${fName}: 32861500Ki -> 31.34 GiB`, () => {
      assert.strictEqual(format('32861500Ki'), '31.34 GiB');
    });

    test(`${fName}: 32861504Ki -> 31.34 GiB`, () => {
      assert.strictEqual(format('32861504Ki'), '31.34 GiB');
    });

    test(`${fName}: 32864708Ki -> 31.34 GiB`, () => {
      assert.strictEqual(format('32864708Ki'), '31.34 GiB');
    });

    // 2. Binary unit tests
    test(`${fName}: 2048Mi -> 2 GiB`, () => {
      assert.strictEqual(format('2048Mi'), '2 GiB');
    });

    test(`${fName}: 1Gi -> 1 GiB`, () => {
      assert.strictEqual(format('1Gi'), '1 GiB');
    });

    test(`${fName}: 1Ti -> 1024 GiB`, () => {
      assert.strictEqual(format('1Ti'), '1024 GiB');
    });

    test(`${fName}: 16384Mi -> 16 GiB`, () => {
      assert.strictEqual(format('16384Mi'), '16 GiB');
    });

    test(`${fName}: 32768Mi -> 32 GiB`, () => {
      assert.strictEqual(format('32768Mi'), '32 GiB');
    });

    test(`${fName}: 1024Mi -> 1 GiB`, () => {
      assert.strictEqual(format('1024Mi'), '1 GiB');
    });

    test(`${fName}: 1048576Ki -> 1 GiB`, () => {
      assert.strictEqual(format('1048576Ki'), '1 GiB');
    });

    test(`${fName}: 1024Ki -> 0.001 GiB`, () => {
      assert.strictEqual(format('1024Ki'), '0.001 GiB');
    });

    // 3. Higher units and plain bytes
    test(`${fName}: 1Pi -> 1048576 GiB`, () => {
      assert.strictEqual(format('1Pi'), '1048576 GiB');
    });

    test(`${fName}: 1Ei -> 1073741824 GiB`, () => {
      assert.strictEqual(format('1Ei'), '1073741824 GiB');
    });

    test(`${fName}: Plain bytes 138803650331 -> 129.27 GiB`, () => {
      assert.strictEqual(format('138803650331'), '129.27 GiB');
      assert.strictEqual(format(138803650331), '129.27 GiB');
    });

    test(`${fName}: 1073741824 (exact 1 GiB in bytes) -> 1 GiB`, () => {
      assert.strictEqual(format(1073741824), '1 GiB');
      assert.strictEqual(format('1073741824'), '1 GiB');
    });

    // 4. Decimal formatting and no trailing zeros
    test(`${fName}: Removes unnecessary trailing zeros (8Gi -> 8 GiB, not 8.00)`, () => {
      assert.strictEqual(format('8Gi'), '8 GiB');
      assert.notStrictEqual(format('8Gi'), '8.00 GiB');
      assert.notStrictEqual(format('8Gi'), '8.000000 GiB');
    });

    test(`${fName}: Max 2 decimal places for fractions (7.75128... -> 7.75 GiB)`, () => {
      assert.strictEqual(format('8127828Ki'), '7.75 GiB');
      assert.notStrictEqual(format('8127828Ki'), '7.750000 GiB');
    });

    // 5. Zero and edge cases
    test(`${fName}: 0 -> 0 GiB`, () => {
      assert.strictEqual(format(0), '0 GiB');
      assert.strictEqual(format('0'), '0 GiB');
      assert.strictEqual(format('0Ki'), '0 GiB');
      assert.strictEqual(format('0Mi'), '0 GiB');
      assert.strictEqual(format('0Gi'), '0 GiB');
    });

    test(`${fName}: Null / undefined / empty string -> '—'`, () => {
      assert.strictEqual(format(null), '—');
      assert.strictEqual(format(undefined), '—');
      assert.strictEqual(format(''), '—');
      assert.strictEqual(format('   '), '—');
    });

    test(`${fName}: Invalid Kubernetes quantities -> '—'`, () => {
      assert.strictEqual(format('invalid-qty'), '—');
      assert.strictEqual(format('abc'), '—');
      assert.strictEqual(format('Ki'), '—');
      assert.strictEqual(format(-100), '—');
    });

    test(`${fName}: Very large values`, () => {
      assert.strictEqual(format('1000000Gi'), '1000000 GiB');
    });

    // 6. Case sensitivity & trailing B tolerance
    test(`${fName}: Tolerates Kib, GiB, etc.`, () => {
      assert.strictEqual(format('1024Mib'), '1 GiB');
      assert.strictEqual(format('2GiB'), '2 GiB');
    });
  }

  // 7. Test Live Backend API backward compatibility
  console.log('\n--- Testing Live Backend API Compatibility ---');
  try {
    const res = await fetch('http://localhost:5100/api/nodes');
    const json = await res.json();
    assert.strictEqual(res.status, 200, 'API should return 200');
    assert(Array.isArray(json.data), 'data should be array');

    const master = json.data.find((n) => n.name === 'sps-nexus-k8s-master01');
    assert(master, 'Master node should exist');
    test('Live API preserves raw Kubernetes memoryCapacity (8127828Ki)', () => {
      assert.strictEqual(master.memoryCapacity, '8127828Ki');
    });

    test('Live API preserves raw Kubernetes cpuCapacity (4)', () => {
      assert.strictEqual(master.cpuCapacity, '4');
    });

    test('Live API preserves raw allocatableMemory (8025428Ki)', () => {
      assert.strictEqual(master.allocatableMemory, '8025428Ki');
    });

    test('Frontend formatter cleanly converts live API memoryCapacity to GiB', () => {
      const formatted = frontendFormatMemory(master.memoryCapacity);
      assert.strictEqual(formatted, '7.75 GiB');
    });

    test('Frontend formatter cleanly converts live API allocatableMemory to GiB', () => {
      const formatted = frontendFormatMemory(master.allocatableMemory);
      assert.strictEqual(formatted, '7.65 GiB');
    });

    test('CPU capacity is NOT formatted as memory', () => {
      // In UI, cpuCapacity is passed to display(), not formatMemoryQuantity
      const cpu = master.cpuCapacity;
      assert.strictEqual(cpu, '4');
      assert(!cpu.includes('GiB'), 'CPU should not contain GiB');
    });
  } catch (err) {
    console.error('❌ FAIL: Live API test error ->', err.message);
    failed++;
  }

  console.log('\n========================================');
  console.log(`Tests finished: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
