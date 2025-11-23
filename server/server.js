const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

let latestData = { temp: null, hum: null, time: null };

// ---- Receive data from Python → GET /upload ----
app.get("/upload", (req, res) => {
    const temp = req.query.temp;
    const hum = req.query.hum;

    if (!temp || !hum) {
        return res.status(400).send("Missing data");
    }

    latestData = {
        temp,
        hum,
        time: new Date().toLocaleTimeString()
    };

    console.log("Received:", latestData);
    res.send("OK");
});

// ---- Frontend fetches latest values ----
app.get("/latest", (req, res) => {
    res.json(latestData);
});

// ---- Start server ----
app.listen(5000, () => {
    console.log("Backend running at http://localhost:5000");
});
