import mongoose from 'mongoose';
import { Question } from './server/models/Question.js';
import dotenv from 'dotenv';

dotenv.config({ path: './server/.env' });

async function checkQuestions() {
    await mongoose.connect(process.env.MONGODB_URI);
    const questions = await Question.find({ type: 'descriptive', text: /Question regarding/ });
    console.log(`Found ${questions.length} descriptive questions with fallback text.`)
    if (questions.length > 0) {
        console.log("Sample:", questions[0]);
    }
    process.exit();
}
checkQuestions();
