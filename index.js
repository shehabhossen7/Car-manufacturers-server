const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "unAuthorized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    // console.log(token, decoded, err);
    req.decoded = decoded;
    next();
  });
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wvwif.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();

    const partsCollection = client.db("CarManufacturers").collection("parts");

    const parchesCollection = client
      .db("CarManufacturers")
      .collection("parches");

    const userCollection = client.db("CarManufacturers").collection("user");

    const reviewCollection = client.db("CarManufacturers").collection("review");

    app.get("/parts", async (req, res) => {
      const query = {};
      const cursor = partsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/parts", verifyJWT, async (req, res) => {
      const parts = req.body;
      const result = await partsCollection.insertOne(parts);
      res.send({ success: true, result });
    });

    app.delete("/parts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await partsCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/parts/:id", async (req, res) => {
      const id = req.params.id;
      const query = {};
      const cursor = partsCollection.find(query);
      const allParts = await cursor.toArray();
      const part = allParts.find((itm) => itm._id == id);
      res.send(part);
    });

    app.get("/parches", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const decodedEmail = req.decoded.email;
      if (email === decodedEmail) {
        const cursor = parchesCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      } else {
        return res.status(403).send({ message: "Forbidden Access" });
      }
    });

    app.get("/parches/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const orders = await parchesCollection.findOne(query);
      // const orders = await cursor.toArray();
      // const part = orders.find((itm) => itm._id == id);
      // console.log(id, orders);
      res.send(orders);
    });

    app.delete("/parches/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await parchesCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/parches", verifyJWT, async (req, res) => {
      const parches = req.body;
      const result = await parchesCollection.insertOne(parches);
      res.send({ success: true, result });
    });

    app.post("/create-payment", async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    app.post("/review", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send({ success: true, result });
    });

    app.get("/review", async (req, res) => {
      const query = {};
      const cursor = reviewCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" }
      );
      res.send({ result, accessToken: token });
    });

    app.put("/users/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const user = req.body;
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send({ result });
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      res.send(user);
    });

    app.get("/users", verifyJWT, async (req, res) => {
      const query = {};
      const cursor = userCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.put("/user/admin/:email", async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        const filter = { email: email };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        return res.status(403).send({ message: "Forbidden Access" });
      }
    });

    app.get("/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({
        email: email,
      });
      const isAdmin = user.role === "admin";
      res.send(isAdmin);
    });
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("our server is running successfully ");
});

app.listen(port, () => {
  console.log("server is connected on port: ", port);
});
