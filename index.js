const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const morgan = require('morgan')
const jwt = require('jsonwebtoken')
//const nodemailer = require('nodemailer')
const port = process.env.PORT || 5001
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)

// middleware
const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(morgan('dev'))

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lgxhzmz.mongodb.net/?retryWrites=true&w=majority`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})
// validate jwt
const verifyJWT = (req,res, next) => {
  const authorization = req.headers.authorization
  if(!authorization){
    return res 
    .status(401)
    .send({error:true,message:'Unauthorized Access'})
  }
   //console.log(authorization);
   const token = authorization.split(' ')[1]
  // console.log(token);
   jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=> {
   if(err){
    return res 
    .status(401)
    .send({error:true,message:'Unauthorized Access'})
   }
   req.decoded = decoded
   next()
   })
  }



async function run() {
  try {
    const usersCollection = client.db('Travel-haven').collection('users')
    const roomsCollection = client.db('Travel-haven').collection('rooms')
    const bookingsCollection = client.db('Travel-haven').collection('bookings')

    // generate client secret for stripe payment
    app.post('/create-payment-intent', verifyJWT,async(req,res) => {
      const {price}  = req.body
      //console.log(price);
      if(price){
        //anything what is related to price convert them with parseFloat instead parseInt ,its the better choice

        const amount = parseFloat(price)*100
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency:'usd',
          payment_method_types:['card'],
        })
        res.send({clientSecret: paymentIntent.client_secret})
      }
    })

    //generate JWT token
    app.post('/jwt',async (req,res) => {
      const email = req.body
      const token = jwt.sign(email,process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1d'
    })
  
      //console.log(email);
      console.log(token);
      res.send({token}) 
    })

    // save user email and in database
    app.put('/users/:email', async(req,res) =>{
        const email = req.params.email
        const user = req.body 
        const query = {email:email}
        const options = {upsert:true}
        const updateDoc = {
            $set: user,
        }
        const result = await usersCollection.updateOne(query,updateDoc,options)
        console.log(result);
        res.send(result)
    })
     //save the room in database
     app.post('/rooms',async (req,res) => {
        const room = req.body
       // console.log(room)
        const result = await roomsCollection.insertOne(room)
        res.send(result)
     })
     //Get all rooms
     app.get('/rooms',async(req,res) =>{
        const result = await roomsCollection.find().toArray()
        res.send(result)
     })
     //Get single room
     app.get('/room/:id', async(req,res) => {
        const id = req.params.id 
        const query = {_id:new ObjectId(id)}
        const result = await roomsCollection.findOne(query)
        //console.log(result);
        res.send(result)
     })
     //get user for the role
     app.get('/users/:email',async(req,res) => {
        const email = req.params.email
        const query = { email:email}
        const result = await usersCollection.findOne(query)
       // console.log(result);
        res.send(result)
     })
     //save the booking infos in database
     app.post('/bookings',async (req,res) => {
        const booking = req.body
       // console.log(booking)
        const result = await bookingsCollection.insertOne(booking)
        res.send(result)
     })
     //update room booking status
     app.patch('/rooms/status/:id', async (req,res) => {
        const id = req.params.id 
        const status = req.body.status 
        const query = {_id:new ObjectId(id)}
        const updateDoc = {
            $set:{
                booked:status,
            }
        }
        const update = await roomsCollection.updateOne(query,updateDoc)
        res.send(update)
     })
     // get bookings for guest
      app.get('/bookings',async (req,res) => {
        const email = req.query.email 
console.log(email);
        if(!email){
            res.send([])
        }
        const query = {'guest.user': email}
        const result = await bookingsCollection.find(query).toArray()
       // console.log(result);
        res.send(result)
     })
     //delete booking
     app.delete('/bookings/:id',async(req,res) => {
        const id = req.params.id 
        const query ={ _id:new ObjectId(id)}
        const result = await bookingsCollection.deleteOne(query)
        res.send(result)
     })
     //get all rooms for host 
     app.get('/rooms/:email',verifyJWT, async(req,res) => {
      const decodedEmail = req.decoded.email
      console.log(decodedEmail);
        const email= req.params.email
        if(email !== decodedEmail){
          return res 
          .status(403)
          .send({error:true,message:'Forbidden Access'})
        }
       // console.log(email);
        const query = {'host.email': email}
        const result = await roomsCollection.find(query).toArray()
        //console.log(result);
        res.send(result)
     })
     //delete rooms
     app.delete('/rooms/:id', async(req,res) =>{
        const id = req.params.id 
        const query = {_id:new ObjectId(id)}
        const result = await roomsCollection.deleteOne(query)
        console.log(result);
        res.send(result)
     })
       // get bookings for host
       app.get('/bookings/host',async (req,res) => {
        const email = req.query.email 
console.log(email);
        if(!email){
            res.send([])
        }
        const query = {'host': email}
        const result = await bookingsCollection.find(query).toArray()
       // console.log(result);
        res.send(result)
     })
      
 
             
    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Travel haven Server is running..')
})

app.listen(port, () => {
  console.log(`Travel Haven is running on port ${port}`)
})