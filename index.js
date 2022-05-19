const express = require('express')
const app = express()
const port = process.env.PORT || 5000
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
var jwt = require('jsonwebtoken');
const { accepts } = require('express/lib/request');

app.use(cors())
app.use(express.json())



function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' })
    }

    const token = authHeader.split(' ')[1]

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded
        next()
        console.log( "what is the value",decoded.foo) // bar
    });

}




const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASSWORD}@cluster0.frwov.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
console.log('no problem')

async function run() {
    try {
        await client.connect();
        const servicesCollection = client.db('doctor_Portal').collection('service');
        const bookingCollection = client.db('doctor_Portal').collection('booking');
        const userCollection = client.db('doctor_Portal').collection('user');

        app.get('/service', async (req, res) => {
            const query = {}
            const cursor = servicesCollection.find(query);
            const services = await cursor.toArray(cursor);
            res.send(services)
        })

        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray()
            res.send(users)
        })

        app.get('/admin/:email',async (req, res)=>{
            const email = req.params.email
            const user = await userCollection.findOne({email: email})
            const isAdmin = user.role === 'Admin'
            res.send({admin: isAdmin})
        })
        //making the user as a admin =75(7)
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email
            const requester = req.decoded.email
            const requesterAccount = await userCollection.findOne({ email: requester })
            if (requesterAccount.role === 'Admin') {
                const filter = { email: email }
                // const options = { upsert: true }
                const updateDoc = {
                    $set: { role: 'Admin' },
                }
                const result = await userCollection.updateOne(filter, updateDoc);

                res.send(result)
            }
            else {
                res.status(403).send({ message: 'forbidden' })
            }

            // res.send({ result,  token }) //both are correct
        })


        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user,
            }
            const result = await userCollection.updateOne(filter, updateDoc, options);
            var token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1hr' });
            res.send({ result, token })
            // res.send({ result,  token }) //both are correct
        })

        app.get('/available', async (req, res) => {
            const date = req.query.date


            //Warning:
            //This is not the proper way to query
            //After learning more about mongodb. use aggregate lookup, pipeline, match, group 

            //step 1: get all service 
            const services = await servicesCollection.find().toArray()

            ///step 2: get the booking of that day
            const query = { date: date }
            const bookings = await bookingCollection.find().toArray()

            //3: for each service
            services.forEach(service => {
                //step 4: find bookings for that service. output: [{},{},{}]
                const serviceBookings = bookings.filter(b => b.treatment === service.name)
                //step 5: select slots for the service bookings: ['', '', '','','']
                const bookedSlots = serviceBookings.map(book => book.slot)
                //step 6: select those slots that are not in bookedSlot
                const available = service.slots.filter(s => !bookedSlots.includes(s))
                //step 7: set variable to slots ot make it easier 
                // service.slots = available
                service.slots = available
                // res.send(available)
                // service.booked = serviceBookings.map(s => s.slot)
            })

            res.send(services)
        })

        /*
        *API Naming Convention
        *app.get('/booking) //get all booking collection , or get more than one or 
        *app.get('/booking/:id') //get a specific booking
        *app.post"('/booking') // add a new booking
        *app.patch('/booking/:id') //
        *app.put('/booking/:id) // upsert ==> update (if exist) or insert (if dosen't exist)
        *app.delete('/booking/:id) //
        */

        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient
            const query = { patient: patient }

            // const authorization = req.headers.authorization
            // console.log('auth header', authorization)
            const bookings = await bookingCollection.find(query).toArray();
            res.send(bookings);
            // const appointment = bookingCollection.find(query)
            // const list = await cursor.toArray()
            // res.send(list)
        })


        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exist = await bookingCollection.findOne(query)
            if (exist) {
                return res.send({ success: false, booking: exist })
            }
            const result = await bookingCollection.insertOne(booking)
            res.send({ success: true, result })

        })
    }
    finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello doctors portal World!')
})

app.listen(port, () => {
    console.log(`i am hearing ${port}`)
})