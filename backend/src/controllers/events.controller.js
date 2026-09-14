const eventsService = require('../services/kubernetes/events.service');
const { sendList } = require('../utils/response');

async function getEvents(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await eventsService.listEvents(namespace);
  return sendList(res, data, namespace ? { namespace } : {});
}

module.exports = {
  getEvents,
};
