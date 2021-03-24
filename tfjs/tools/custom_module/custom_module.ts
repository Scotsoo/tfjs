/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import {CustomModuleFiles, CustomTFJSBundleConfig, ImportProvider} from './types';
import {getPreamble} from './util';

export function getCustomModuleString(
    config: CustomTFJSBundleConfig,
    moduleProvider: ImportProvider,
    ): CustomModuleFiles {
  const {kernels, backends, forwardModeOnly, models} = config;
  const tfjs: string[] = [getPreamble()];

  // A custom tfjs module
  addLine(tfjs, moduleProvider.importCoreStr(forwardModeOnly));
  if (models.length > 0) {
    // A model.json has been passed.
    addLine(tfjs, moduleProvider.importConverterStr());
  }

  for (const backend of backends) {
    addLine(tfjs, `\n//backend = ${backend}`);
    addLine(tfjs, moduleProvider.importBackendStr(backend));
    for (const kernelName of kernels) {
      const kernelImport = moduleProvider.importKernelStr(kernelName, backend);
      if (kernelImport.importStatement) {
        addLine(tfjs, kernelImport.importStatement);
        addLine(tfjs, registerKernelStr(kernelImport.kernelConfigId));
      }
    }
  }

  if (!forwardModeOnly) {
    addLine(tfjs, `\n//Gradients`);
    for (const kernelName of kernels) {
      const gradImport = moduleProvider.importGradientConfigStr(kernelName);
      if (gradImport.importStatement) {
        addLine(tfjs, gradImport.importStatement);
        addLine(tfjs, registerGradientConfigStr(gradImport.gradConfigId));
      }
    }
  }

  // A custom tfjs core module for imports within tfjs packages
  const core: string[] = [getPreamble()];
  addLine(core, moduleProvider.importCoreStr(forwardModeOnly));
  return {
    core: core.join('\n'),
    tfjs: tfjs.join('\n'),
  };
}

export function getCustomConverterOpsModule(
    ops: string[], moduleProvider: ImportProvider): string {
  const result: string[] = ['// This file is autogenerated\n'];

  // Separate namespaced apis from non namespaced ones as they require a
  // different export pattern that treats each namespace as a whole.

  const flatOps = [];
  const namespacedOps: {[key: string]: string[]} = {};

  for (const opSymbol of ops) {
    if (opSymbol.match(/\./)) {
      const parts = opSymbol.split(/\./);
      const namespace = parts[0];
      const opName = parts[1];

      if (namespacedOps[namespace] == null) {
        namespacedOps[namespace] = [];
      }
      namespacedOps[namespace].push(opName);
    } else {
      flatOps.push(opSymbol);
    }
  }

  // Group the namespaced symbols by namespace
  for (const namespace of Object.keys(namespacedOps)) {
    const opSymbols = namespacedOps[namespace];
    result.push(moduleProvider.importNamespacedOpsForConverterStr(
        namespace, opSymbols));
  }

  for (const opSymbol of flatOps) {
    result.push(moduleProvider.importOpForConverterStr(opSymbol));
  }

  return result.join('\n');
}

function addLine(target: string[], line: string) {
  target.push(line);
}

function registerKernelStr(kernelConfigId: string) {
  return `registerKernel(${kernelConfigId});`;
}

function registerGradientConfigStr(gradConfigId: string) {
  return `registerGradient(${gradConfigId});`;
}
