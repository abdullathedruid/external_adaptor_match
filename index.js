const { Requester, Validator, AdapterError } = require('@chainlink/external-adapter')
// Define custom error scenarios for the API.
// Return true for the adapter to retry.
const customError = (data) => {
  if (data.Response === 'Error') return true
  return false
}

// Define custom parameters to be used by the adapter.
// Extra parameters can be stated in the extra object,
// with a Boolean value indicating whether or not they
// should be required.
const customParams = {
  matchid: ['matchid'],
  endpoint: ['endpoint']
}

function validateResultString (data) {
  if (typeof data === 'undefined') {
    const error = 'Result could not be found in path'
    console.log(error)
    throw new AdapterError(error)
  }
  if (data === '') {
    const error = 'Invalid result'
    console.log(error)
    throw new AdapterError(error)
  }
  return data
}

const createRequest = (input, callback) => {
  // The Validator helps you validate the Chainlink request data
  const validator = new Validator(callback, input, customParams)
  const jobRunID = validator.validated.id
  const matchid = validator.validated.data.matchid
  const endpoint = validator.validated.data.endpoint
  const base_url = 'https://api.football-data.org/v2/'
  var final_url = ''

  const headers = {
    'X-Auth-Token': '3263b9d91c754a82af65d75ce2c86474'
  }

  switch (endpoint) {
    case 'outcome':
      final_url = base_url + `matches/${matchid}`
      console.log(final_url)
      const params = {}
      const config = {
        url: final_url,
        params,
        headers
      }
      // The Requester allows API calls be retry in case of timeout
      // or connection failure
      Requester.request(config, customError)
        .then(response => {
          // It's common practice to store the desired value at the top-level
          // result key. This allows different adapters to be compatible with
          // one another.
          const output = validateResultString(Requester.getResult(response.data, ['match','score','winner']))
          switch (output) {
            case "HOME_TEAM":
              response.data.result = 1;
              break;
            case "DRAW":
              response.data.result = 2;
              break;
            case "AWAY_TEAM":
              response.data.result = 3;
              break;
            default:
              response.data.result = 0;
          }

          callback(response.status, Requester.success(jobRunID, response))
        })
        .catch(error => {
          callback(500, Requester.errored(jobRunID, error))
        })
    break;

    default:
      console.log('invalid parameter')
  }

}

// This is a wrapper to allow the function to work with
// GCP Functions
exports.gcpservice = (req, res) => {
  createRequest(req.body, (statusCode, data) => {
    res.status(statusCode).send(data)
  })
}

// This is a wrapper to allow the function to work with
// AWS Lambda
exports.handler = (event, context, callback) => {
  createRequest(event, (statusCode, data) => {
    callback(null, data)
  })
}

// This is a wrapper to allow the function to work with
// newer AWS Lambda implementations
exports.handlerv2 = (event, context, callback) => {
  createRequest(JSON.parse(event.body), (statusCode, data) => {
    callback(null, {
      statusCode: statusCode,
      body: JSON.stringify(data),
      isBase64Encoded: false
    })
  })
}

// This allows the function to be exported for testing
// or for running in express
module.exports.createRequest = createRequest
