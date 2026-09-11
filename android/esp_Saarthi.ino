#include <WiFi.h>
#include <WebServer.h>

// =====================================================
// ESP32 WIFI ACCESS POINT
// =====================================================

const char* ssid = "ESP32_CONTROL";
const char* password = "12345678";

// Web server on port 80
WebServer server(80);


// =====================================================
// HTML WEBSITE
// =====================================================

const char webpage[] PROGMEM = R"rawliteral(

<!DOCTYPE html>
<html>

<head>

<meta name="viewport" content="width=device-width, initial-scale=1">

<title>Saarthi</title>

<style>

body {
    margin: 0;
    font-family: Arial;
    background: #111;
    color: white;
    text-align: center;
}

.container {
    padding: 30px 15px;
}

h1 {
    color: #00ff88;
}

input {

    width: 85%;
    max-width: 400px;

    padding: 15px;

    font-size: 18px;

    border-radius: 10px;

    border: none;

    outline: none;

}

button {

    margin: 10px;

    padding: 15px 25px;

    font-size: 18px;

    border: none;

    border-radius: 10px;

    cursor: pointer;

    background: #00aa55;

    color: white;

}

button:hover {

    background: #00dd77;

}

#status {

    margin-top: 20px;

    font-size: 18px;

    color: #00ff88;

}

</style>

</head>


<body>

<div class="container">

<h1>Saarthi</h1>

<p>Send a message to the ESP32</p>


<input
id="message"
type="text"
placeholder="Enter message"
>


<br>


<button onclick="sendMessage()">

Send Message

</button>


<br>








<br>







<br>





<div id="status">

Waiting...

</div>


</div>


<script>

function sendMessage() {

    let message =
    document.getElementById("message").value;

    fetch("/send?msg=" +
    encodeURIComponent(message))

    .then(response => response.text())

    .then(data => {

        document.getElementById("status")
        .innerHTML = data;

    });

}


function sendCommand(command) {

    fetch("/send?msg=" +
    encodeURIComponent(command))

    .then(response => response.text())

    .then(data => {

        document.getElementById("status")
        .innerHTML = data;

    });

}

</script>


</body>

</html>

)rawliteral";


// =====================================================
// HANDLE MAIN WEBSITE
// =====================================================

void handleRoot() {

    server.send(
        200,
        "text/html",
        webpage
    );

}


// =====================================================
// RECEIVE MESSAGE
// =====================================================

void handleMessage() {

    if (server.hasArg("msg")) {

        String message =
        server.arg("msg");

        Serial.print("Received message: ");

        Serial.println(message);


        // =============================================
        // YOUR ESP32 ACTIONS GO HERE
        // =============================================


        if (message == "FORWARD") {

            Serial.println("Robot Forward");

            // moveForward();

        }


        else if (message == "BACKWARD") {

            Serial.println("Robot Backward");

            // moveBackward();

        }


        else if (message == "LEFT") {

            Serial.println("Robot Left");

            // turnLeft();

        }


        else if (message == "RIGHT") {

            Serial.println("Robot Right");

            // turnRight();

        }


        else if (message == "STOP") {

            Serial.println("Robot Stop");

            // stopMotors();

        }


        server.send(
            200,
            "text/plain",
            "Message sent: " + message
        );

    }

    else {

        server.send(
            400,
            "text/plain",
            "No message received"
        );

    }

}


// =====================================================
// SETUP
// =====================================================

void setup() {

    Serial.begin(115200);


    // Start ESP32 WiFi Access Point

    WiFi.softAP(
        ssid,
        password
    );


    Serial.println();

    Serial.println("ESP32 WiFi Started");


    Serial.print("WiFi Name: ");

    Serial.println(ssid);


    Serial.print("Website Address: ");

    Serial.println(
        WiFi.softAPIP()
    );


    // Website

    server.on(
        "/",
        handleRoot
    );


    // Message endpoint

    server.on(
        "/send",
        handleMessage
    );


    // Start server

    server.begin();


    Serial.println(
        "Web Server Started"
    );

}


// =====================================================
// LOOP
// =====================================================

void loop() {

    server.handleClient();

}