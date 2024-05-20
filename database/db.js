import mongoose, { connect } from "mongoose";

const dbConnection = () => {
    mongoose.connect(process.env.MONGO_URL, {
        dbName:"portfolio"
    }).then(() => {
        console.log("Connect to Database");
    }).catch((err) => {
        console.log(err.message);
    })
}

export default dbConnection;