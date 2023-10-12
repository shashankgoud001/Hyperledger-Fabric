cd ./test-network
export PATH=${PWD}/../bin:$PATH
./network.sh up createChannel -ca -s couchdb
./network.sh deployCC -ccn start1 -ccp ../asset-transfer-events/chaincode-javascript -ccl javascript -ccep "OR('Org1MSP.peer','Org2MSP.peer')"
cd ../asset-transfer-events/application-javascript/
npm i
node app.js

