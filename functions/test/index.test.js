const sinon = require('sinon');
const chai = require('chai');
const assert = chai.assert;
const admin = require('firebase-admin');
const test = require('firebase-functions-test')();

describe('Charity Discount Functions', () => {
  let myFunctions, adminInitStub;

  before(() => {
    adminInitStub = sinon.stub(admin, 'initializeApp');
    test.mockConfig({
      mail: {
        api_key: '1234',
        domain: 'charitydiscount.ro',
        name: 'Charity Discount Test',
        user: 'test@charitydiscount.ro',
      },
      elastic: {
        index_programs: 'programs',
        index_products: 'products',
        featured: 'carti',
        pass: 'testpass',
        endpoint: 'http://localhost/elasticsearch',
        user: 'user',
      },
      cache: {
        endpoint: 'localhost:11211',
        pass: 'test',
        user: 'test',
      },
      twop: {
        pass: 'test',
        email: 'charitydiscount@gmail.com',
      },
    });
  });

  after(() => {
    adminInitStub.restore();
    test.cleanup();
  });

  describe('updateOverallRating', () => {
    before(() => {
      const firestoreStub = sinon.stub(admin, 'firestore');

      const setStub = sinon.stub();
      setStub
        .withArgs(
          { ratings: { testProgramID: { count: 3, rating: 4 } } },
          { merge: true },
        )
        .returns(true);

      firestoreStub.get(() => {
        return () => {
          return {
            collection: (colName) => {
              return {
                doc: (docName) => {
                  return {
                    set: setStub,
                  };
                },
              };
            },
          };
        };
      });

      const messagingStub = sinon.stub(admin, 'messaging');
      messagingStub.get(() => {
        return () => {
          return {
            sendToDevice: (deviceToken, notification) => {
              return true;
            },
          };
        };
      });

      const storageStub = sinon.stub(admin, 'storage');
      storageStub.get(() => {
        return () => {
          return {
            bucket: (bucketName) => {
              return true;
            },
          };
        };
      });
      myFunctions = require('../lib/index');
    });
    // Test Case: Adding a new review with rating 5, besides already existing ratings 3 and 4
    // should result in the set function being called with rating 4
    it('should compute new overall rating (4) and save it in /meta/programs', () => {
      const wrappedUpdateOverall = test.wrap(myFunctions.updateOverallRating);

      const snap = {
        after: {
          data: () => {
            return {
              reviews: {
                '0': { rating: 3 },
                '1': { rating: 4 },
                '2': { rating: 5 },
              },
              shopUniqueCode: 'testProgramID',
            };
          },
        },
      };

      return assert.equal(wrappedUpdateOverall(snap), true);
    });
    after(() => {
      adminInitStub.restore();
      test.cleanup();
    });
  });
});
