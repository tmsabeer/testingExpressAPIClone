const express = require("express")
const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const cors = require("cors")



const serverless = require("serverless-http")

const app = express()

app.use(cors())

app.use(express.json())
const router = express.Router()



const reqBody = {
    client_id: 'b00b532d-ecc7-4fe2-a9f8-48f6deeade13',
    client_secret: 'wsA8Q~y4-eNp0ac5SB7eExQlxvz6-DWBapmLhc59',
    resource : 'https://raymond.operations.dynamics.com',
    grant_type :'client_credentials'
}


let downloadData = null;

var accessToken;


/* Home Route */
router.get("/",(req,res)=>{
    res.status(200).json({message:"Home Route"})
})


/* Ping Route */
router.get("/ping",(req,res) =>{
    res.status(200).json({message:"Ping router is working!"})
})



/* Get All Bills Route */
const getAllBills = async (req, res) => {
    try {
         const response = await axios.post('https://login.microsoftonline.com/dec8ecf4-adc1-45cd-9658-0266651fa289/oauth2/token',
        reqBody,
        {
            headers: {
                'Content-Type' : `multipart/form-data; boundary=<calculated when request is sent>`,
              //  'Host' : 'login.microsoftonline.com'
            }
        });

        const token = response.data.access_token;
        accessToken = token

       // res.send(token)

        const billsResponse = await axios.post('https://raymond.operations.dynamics.com/api/services/HSMallManagementServiceGroup/HSMallManagementService/MallManagementData',
        {
            "_fromdate":req.body._fromdate,
            "_toDate":req.body._toDate,
            "_store":"V33"
        },{
            headers: {
                'Content-Type' : `application/json`,
               // 'Host' : 'raydev04dd77c79eeb005e27devaos.axcloud.dynamics.com',
                'Authorization' : `Bearer ${accessToken}`
            }
        });
        const shopData = billsResponse.data

       
         
        // Convert XML response to JSON using xml2js
        const xmlResponse = billsResponse.data;

        const parser = new xml2js.Parser();

        parser.parseString(xmlResponse, (error, result) => {
            if (error) {
                console.error('Error parsing XML:', error);
                res.status(500).json({ error: 'An error occurred.' });
            }           
            downloadData = result;
            res.send(result);
            
        }); 

       
       
    } catch (error) {
        console.error(error);
        res.status(500).json(error);
    }
}


 router.post("/getAllBills",getAllBills) 

 

 /* Download Route */

 const currentDate = new Date();

const year = currentDate.getFullYear();
const month = String(currentDate.getMonth() + 1).padStart(2, '0');
const day = String(currentDate.getDate()).padStart(2, '0');

const formattedDate = `${year}-${month}-${day}`;

const downloadFile = (req, res) => {
    
   if (downloadData) {

    const responseData = downloadData.TransactionDetails

     const folderPath = 'D:/EAINT';
     // Define the file content  
   


    // Sort the data by date (TRANSDATE) in ascending order
responseData.Records.sort((a, b) => new Date(a.TRANSDATE[0]) - new Date(b.TRANSDATE[0]));

// Then, sort by RECEIPTID in ascending order for records with the same date
responseData.Records.sort((a, b) => {
  const dateComparison = new Date(a.TRANSDATE[0]) - new Date(b.TRANSDATE[0]);
  if (dateComparison === 0) {
    return a.RECEIPTID[0].localeCompare(b.RECEIPTID[0]);
  }
  return dateComparison;
});


// Step 1: Filter out negative data
const filteredRecords = responseData.Records.filter(item => parseFloat(item.NETAMOUNT[0]) >= 0);

// Step 2: Remove duplicate data based on RECEIPTID[0]
const uniqueRecords = [];
const receiptIDsSet = new Set();

filteredRecords.forEach(item => {
  const receiptID = item.RECEIPTID[0];
  if (receiptID && !receiptIDsSet.has(receiptID)) {
    receiptIDsSet.add(receiptID);
    uniqueRecords.push(item);
  }
});

// Step 3: Map and format the data
const fileContent2 = uniqueRecords.map(item => `P000284|S000881|${item.SALETYPE[0] === 'SALE' ? 'B' : item.SALETYPE[0] === 'RETURN' ? 'C' : item.SALETYPE[0] === 'SALE' && item.NETAMOUNT[0] < 0 ? 'C'  : 'B'}|${item.RECEIPTID[0]}|${item.TRANSDATE[0]}|${item.QTY[0]}|${parseFloat(item.INVOICEAMOUNT[0])+ parseFloat(item.DISCOUNT[0])}|${item.DISCOUNT[0]}|${item.INVOICEAMOUNT[0]}|${item.NETAMOUNT[0]}|${item.TAXAMOUNT[0]}|${item.SALETYPE[0] === 'SALE' ? 'N' :  'C'}|PAID-I|${formattedDate}`).join('\n');




     const sortedRecords = responseData.Records.sort((a, b) => {
        const dateA = new Date(a.TRANSDATE[0]);
        const dateB = new Date(b.TRANSDATE[0]);
        return dateA - dateB;
      });

      const mostRecentDate = sortedRecords[sortedRecords.length - 1].TRANSDATE[0];
      const mostLastDate = sortedRecords[0].TRANSDATE[0];
   
     // Create the folder if it doesn't exist
     if (!fs.existsSync(folderPath)) {
       fs.mkdirSync(folderPath);
     }
   
     // Create and write to a file within the folder
     fs.writeFileSync(path.join(folderPath, `S000881_${mostLastDate}.EAI`), fileContent2);

    res.status(200).json({message:'File Downloaded Successfully!'});

   } else {
    res.status(500).json({message:'No shared data available'});
   }


  }
  router.get("/download",downloadFile) 




app.use('/.netlify/functions/api',router)

module.exports.handler = serverless(app)
