// import few libraries:
const http=require("http")
const https=require("https")
const url=require("url")
const fs=require("fs")
const query_string = require('querystring')
let code;
const port=3000;
const a = require('./auth/fistAttempt.json');
const {client_id,scope,response_type,redirect_uri,client_secret}=require('./auth/secret.json')
const sendDriveTask = "https://www.googleapis.com/upload/drive/v3/files"		
let token=""
// creating a backend http server , which serve the user request
const server=http.createServer();
server.listen(port)     
// when we have a http server, we want it to have listener to listen to when our server when we host it on a port
// when server goes online and waiting for a user request , the listening event happens 
server.on("listening",listener_handler)
function listener_handler(){
    console.log(`Server is on and ready to handle request on port ${port}`)
}



// server listening for the request event to trigger and every time a user send a request it is detected by the server
// The respond to the request is handled by the callback function 
server.on("request",handleRequest)
function handleRequest(req,respond){
    // If the request url is the home page, it will be catch by this block 
   
    if(req.url ==="/")
    {
        // The index.html will be returned to the user html page as stream  
         // The form include a business name field and city which the user will provide
         // The form include a submit button, which when the press trigger "/search" action 
        const form=fs.createReadStream('./html/index.html');
        // if the request was done correctly , the respond status code is 200. The content type is in form html.
        respond.writeHead(200,{"Content-Type":"text/html"});   
        // the response is piped to the screen, 
        form.pipe(respond);

    }

    // when the user request to do the search, the url path will be /search
    else if (req.url.startsWith("/search"))
    {
        // putting the required parameters for google drive api call in order to make the api call 
        let p={client_id, scope, response_type,redirect_uri};
        const e=`https://accounts.google.com/o/oauth2/auth` ;  // google drive api call
        let parameters = query_string.stringify(p);
        const query=url.parse(req.url,true).query; // retrieving the queries from the the url, include business and city which was provided by the user
        console.log(query)
        // The most important part of option object is the header file which include the Authorization attribute which is the client secret which is used the authenticate the api call your server is sending
        const options = 
        {

            host:'https://api.yelp.com/v3/bussiness',
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${a.client_secret}`
            },
        }
        let endpoint=`https://api.yelp.com/v3/businesses/search?term=${query.store}&location=${query.city}`; // this is the end point
        // making the api request 
        console.log("Sending request to yelp to get data...")
        const yelp_api=https.request(endpoint,options);
        yelp_api.on("response",(yelpAPI_res)=>{
            process_stream(yelpAPI_res,pars_results,respond)
        })
        // the response is redirected to google auth endpoint along with require parameters 
        // 302 is the code to redirection of the url
        respond.writeHead(302,{Location: `${e}?${parameters}`})
        yelp_api.end();
   
    }
    // When the respone is redirected to the googledrive authentication endpoint the url google send back would be something the you configured 
    // in the Google API console
    else if(req.url.startsWith("/userSignin"))
    {
        
        // An access code will be send from google drive authentication endpoint to the server
        const {code, scope} =  url.parse(req.url, true).query;
        console.log(`Access Code: ${code}`);
        console.log("Exchanging AccessCode For Access Token....")
        // exchanging the access code with an access token 
        exchangeAccessCodeToAccessToken(code,respond);

    }
}
   

//A  https request will be sent to token end point to exchange the access code for an access token 
function exchangeAccessCodeToAccessToken(code,respond)
{
    const token_endpoint="https://oauth2.googleapis.com/token";
    const options = {
        method: "POST",
        headers:{
            "Content-Type":'application/x-www-form-urlencoded'

        },
    }  
const tokenRequest = https.request(token_endpoint, options, (res)=>{

    res.on("data",(res)=>{
        token = res;
    });
    res.on("end", () => {
        try {
            token = JSON.parse(token);
            let tk=JSON.stringify(token);
            console.log(`Token: ${tk}`)
            // console.log(token);
            // a access token will be return to you as the response for the https request as json file
            // the json file will be save in local repository token.json
            fs.writeFileSync("token.json",tk)   

            // ready to make the API
            drive_request()
            respond.writeHead(200); // 200 status code will be return if the respond is successful 
            // token should be available here, and api can be call write below
            
            respond.end();
        }
        catch (e) {
            console.error(e.message);
        }
    });
});

const tokenRequestBody = ``+
    `grant_type=authorization_code&`+
    `code=${code}&`+
    `client_id=${client_id}&`+
    `client_secret=${client_secret}&`+
    `redirect_uri=${redirect_uri}`;
tokenRequest.end(tokenRequestBody);

}




function process_stream(stream,callback,... args)
{
            let body="";
            stream.on("data",chunk => {
                body+=chunk
            }
            );
            stream.on("end",()=>callback(body, ... args));
}





function pars_results(data,res)
{
        // JSON.parse(text) return an javascript object; opposite of this is stringtfy() which convert object to JSON object
      let r="";
        console.log("Yelp data being parsed...")
    //   console.log(data);
        const a=JSON.parse(data);
       business=a.businesses;
    //   console.log(a.businesses)
        business.forEach(element => {
        results= `${element.name}: ${element.location.address1}, ${element.location.city} \r\n`;
        r+=results
        })
    // Using writeFileSyn is one way to synchronize the API calls, If asynchronous function were to use we could have done the second API call
    // in the callback of writeFile because that's when data is available to the server.     
    fs.writeFileSync("output.txt",r);

    res.end(r);

}



function drive_request(){
	const sendDriveTask = "https://www.googleapis.com/upload/drive/v3/files"		
	const textDoc = fs.readFileSync('./output.txt').toString()
    let Credential=fs.readFileSync("token.json");
    Credential=JSON.parse(Credential)
	const options = {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${Credential.access_token}`,
			"scope": `${Credential.scope}`,
			"Content-Type":'text/plain' 
		},
	}
    

	console.log("sending data to google drive")
    
	let https_ClientRequest=https.request(
		sendDriveTask,
		options,
		(res, err) => {
			if(err) {
				console.log(err)
			} else {
				console.log("success", res.statusCode)
			}
		}
	)
    https_ClientRequest.end(textDoc)
}

