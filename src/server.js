require("dotenv").config();
const connectDB = require("./config/db.js");
const app = require("./app.js");

connectDB();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}` ));