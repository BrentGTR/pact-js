const { VerifierV3 } = require('@pact-foundation/pact/v3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const { server } = require('../provider.js');
const path = require('path');

server.listen(8081, () => {
  console.log('Service listening on http://localhost:8081');
});

// Verify that the provider meets all consumer expectations
describe('Pact Verification', () => {
  it('filter by PACT_DESCRIPTION', () => {
    process.env.PACT_DESCRIPTION = 'a request to be used';
    return new VerifierV3({
      provider: 'filter-provider',
      providerBaseUrl: 'http://localhost:8081',
      pactUrls: [
        path.resolve(process.cwd(), './filter-by-PACT_DESCRIPTION.json'),
      ],
    })
      .verifyProvider()
      .then((output) => {
        console.log('Pact Verification Complete!');
        console.log('Result:', output);
      });
  });
  it('filter by PACT_PROVIDER_STATE', () => {
    process.env.PACT_PROVIDER_STATE = 'a state to be used';
    return new VerifierV3({
      provider: 'filter-provider',
      providerBaseUrl: 'http://localhost:8081',
      pactUrls: [
        path.resolve(process.cwd(), './filter-by-PACT_PROVIDER_STATE.json'),
      ],
    })
      .verifyProvider()
      .then((output) => {
        console.log('Pact Verification Complete!');
        console.log('Result:', output);
      });
  });
  it('filter by PACT_PROVIDER_NO_STATE', () => {
    process.env.PACT_PROVIDER_NO_STATE = 'TRUE';
    return new VerifierV3({
      provider: 'filter-provider',
      providerBaseUrl: 'http://localhost:8081',
      pactUrls: [
        path.resolve(process.cwd(), './filter-by-PACT_PROVIDER_NO_STATE.json'),
      ],
    })
      .verifyProvider()
      .then((output) => {
        console.log('Pact Verification Complete!');
        console.log('Result:', output);
      });
  });
});
