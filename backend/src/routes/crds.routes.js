const express = require('express');
const crdsController = require('../controllers/crds.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const {
  validate,
  crdQuerySchema,
  nameParamSchema,
  crdCoordinatesParamsSchema,
} = require('../middleware/validate');

const router = express.Router();

router.get('/', validate(crdQuerySchema, 'query'), asyncHandler(crdsController.getCRDs));
router.get('/:name', validate(nameParamSchema, 'params'), asyncHandler(crdsController.getCRDByName));
router.get('/:name/yaml', validate(nameParamSchema, 'params'), asyncHandler(crdsController.getCRDYaml));
router.get(
  '/:group/:version/:plural',
  validate(crdCoordinatesParamsSchema, 'params'),
  asyncHandler(crdsController.getCRDByCoordinates)
);

module.exports = router;
