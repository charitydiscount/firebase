# CharityDiscount Firebase Functions, Hosting and DB Config

## Running locally

The [Firebase Local Emulator Suite](https://firebase.google.com/docs/emulator-suite/install_and_configure) can be used to run the system on your machine:

0. Navigate into the **functions** directory
1. Install the firebase CLI tools: `npm install -g firebase-tools`
2. Fetch the environmental variables with `firebase functions:config:get | ac .runtimeconfig.json` (you might have to delete the content of the file before)
3. Compile the source code: `npm run build`
4. Start the suite: `firebase emulators:start --import=<path_to_initial_data_or_data_exported_from_production>` (you can add `--export-on-exit=<path_to_export_data>` to store the data - the emulator does not persist any data)
5. Create some users in auth (doesn't support data export/import) by making a request to the `populateAuthUsers` https function (see terminal for complete URL).
