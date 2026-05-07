/**
 * R7-1 Shader Load Order — Contract Test
 * Run: node docs/tests/r7-1-shader-load-order.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const initCommonPath = path.join(root, 'js/InitCommon.js');

const initCommon = fs.readFileSync(initCommonPath, 'utf8');

assert(
    initCommon.includes('const pendingCommonVertexShaderCallbacks = [];'),
    'InitCommon must keep a queue for shader material callbacks waiting on the common vertex shader'
);
assert(
    initCommon.includes('function runAfterCommonVertexShaderReady(callback)'),
    'InitCommon must expose a helper that waits for the common vertex shader before creating ShaderMaterial'
);
assert(
    initCommon.includes('function flushCommonVertexShaderCallbacks()'),
    'InitCommon must flush queued shader material callbacks after the common vertex shader loads'
);
assert(
    initCommon.includes('function createCommonVertexShaderMaterial(params)'),
    'InitCommon must create common-vertex ShaderMaterial instances through a guarded helper'
);
assert(
    !initCommon.includes('vertexShader: pathTracingVertexShader'),
    'ShaderMaterial creation must not pass pathTracingVertexShader directly because fragment shaders can load first'
);

const waitForCommonVertexMaterials = [
    'pathTracingMaterial',
    'screenCopyMaterial',
    'screenOutputMaterial',
    'bloomBrightpassMaterial',
    'bloomDownsampleMaterial',
    'bloomUpsampleMaterial'
];

for (const materialName of waitForCommonVertexMaterials) {
    const assignment = initCommon.indexOf(`${materialName} = createCommonVertexShaderMaterial({`);
    assert(assignment !== -1, `${materialName} must be created through createCommonVertexShaderMaterial()`);

    const wrapper = initCommon.lastIndexOf('runAfterCommonVertexShaderReady(function ()', assignment);
    assert(wrapper !== -1, `${materialName} must wait for the common vertex shader before material creation`);
}

console.log('PASS  R7-1 shader load order contract');
