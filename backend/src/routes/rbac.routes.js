const express = require('express');
const router = express.Router();
const rbacController = require('../controllers/rbac.controller');
const {
  validate,
  storageQuerySchema,
  nameParamSchema,
  namespacedNameParamsSchema,
  detailQuerySchema,
} = require('../middleware/validate');
const { asyncHandler } = require('../utils/asyncHandler');

// Overview
router.get('/overview', asyncHandler(rbacController.getRBACOverview));

// Service Accounts
router.get(
  '/serviceaccounts',
  validate(storageQuerySchema, 'query'),
  asyncHandler(rbacController.getServiceAccounts)
);
router.get(
  '/serviceaccounts/:namespace/:name',
  validate(namespacedNameParamsSchema, 'params'),
  validate(detailQuerySchema, 'query'),
  asyncHandler(rbacController.getServiceAccountDetails)
);
router.get(
  '/serviceaccounts/:namespace/:name/yaml',
  validate(namespacedNameParamsSchema, 'params'),
  asyncHandler(rbacController.getServiceAccountYaml)
);

// Roles
router.get(
  '/roles',
  validate(storageQuerySchema, 'query'),
  asyncHandler(rbacController.getRoles)
);
router.get(
  '/roles/:namespace/:name',
  validate(namespacedNameParamsSchema, 'params'),
  validate(detailQuerySchema, 'query'),
  asyncHandler(rbacController.getRoleDetails)
);
router.get(
  '/roles/:namespace/:name/yaml',
  validate(namespacedNameParamsSchema, 'params'),
  asyncHandler(rbacController.getRoleYaml)
);

// Role Bindings
router.get(
  '/rolebindings',
  validate(storageQuerySchema, 'query'),
  asyncHandler(rbacController.getRoleBindings)
);
router.get(
  '/rolebindings/:namespace/:name',
  validate(namespacedNameParamsSchema, 'params'),
  validate(detailQuerySchema, 'query'),
  asyncHandler(rbacController.getRoleBindingDetails)
);
router.get(
  '/rolebindings/:namespace/:name/yaml',
  validate(namespacedNameParamsSchema, 'params'),
  asyncHandler(rbacController.getRoleBindingYaml)
);

// Cluster Roles
router.get(
  '/clusterroles',
  validate(storageQuerySchema, 'query'),
  asyncHandler(rbacController.getClusterRoles)
);
router.get(
  '/clusterroles/:name',
  validate(nameParamSchema, 'params'),
  validate(detailQuerySchema, 'query'),
  asyncHandler(rbacController.getClusterRoleDetails)
);
router.get(
  '/clusterroles/:name/yaml',
  validate(nameParamSchema, 'params'),
  asyncHandler(rbacController.getClusterRoleYaml)
);

// Cluster Role Bindings
router.get(
  '/clusterrolebindings',
  validate(storageQuerySchema, 'query'),
  asyncHandler(rbacController.getClusterRoleBindings)
);
router.get(
  '/clusterrolebindings/:name',
  validate(nameParamSchema, 'params'),
  validate(detailQuerySchema, 'query'),
  asyncHandler(rbacController.getClusterRoleBindingDetails)
);
router.get(
  '/clusterrolebindings/:name/yaml',
  validate(nameParamSchema, 'params'),
  asyncHandler(rbacController.getClusterRoleBindingYaml)
);

module.exports = router;
