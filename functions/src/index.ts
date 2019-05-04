import * as admin from "firebase-admin"
import * as functions from "firebase-functions"

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

//Function to check the answer submitted
exports.getUserById = (req, res) => {

    //Extract out the id
    let id = req.body.id;

    var questionRef = db.collection('useres').doc(id.toString());
    questionRef.get()
        .then(doc => {
            if (!doc.exists) {
                throw new Error("No such document");
            } else {
                res.status(200).send(doc);
            }
        })
        .catch(err => {
            console.log('Error getting document', err);
            res.status(400).send('Error');
        });
};