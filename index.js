const Alexa = require('ask-sdk');
const https = require('https');


/* INTENT HANDLERS */

// Launches the spelling bee game
const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === `LaunchRequest`;
  },
  handle(handlerInput) {
    const response = handlerInput.responseBuilder;
    return response.speak(welcomeMessage)
                    .reprompt(helpMessage1)
                    .getResponse();
  },
};

// Launches the question asking process
const QuizHandler = {
  canHandle(handlerInput) {
    console.log("Inside Begin QuizHandler");
    const request = handlerInput.requestEnvelope.request;
    
    return request.type === "IntentRequest" &&
           (request.intent.name === "BeginIntent" || request.intent.name === "AMAZON.StartOverIntent");
  },
  handle(handlerInput) {
    console.log("Inside QuizHandler - handle");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const response = handlerInput.responseBuilder;
    var question = askQuestion(handlerInput);
    var speakOutput = question;
    var repromptOutput = question;
    attributes.state = states.QUIZ;

    return response.speak(speakOutput)
                   .reprompt(repromptOutput)
                   .getResponse();
  },
};

// Evaluates the answer of the user and continues the game if desired
const QuizAnswerHandler = {
  canHandle(handlerInput) {
    console.log("Inside QuizAnswerHandler");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const request = handlerInput.requestEnvelope.request;
    return attributes.state === states.QUIZ &&
           request.type === 'IntentRequest' &&
           request.intent.name === 'AnswerIntent';
  },
  handle(handlerInput) {
    console.log("Inside QuizAnswerHandler - handle");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const response = handlerInput.responseBuilder;
    
    var speakOutput = ``;
    const item = attributes.quizItem;  // Word that is being asked
    const isCorrect = compareSlots(handlerInput.requestEnvelope.request.intent.slots, item.Word);
    if (isCorrect) {
      speakOutput = getSpeechCon(true);
    } 
    else {
      speakOutput = getSpeechCon(false) + getAnswer(item);
    }
    speakOutput += continuation;
    return response.speak(speakOutput)
                   .reprompt(speakOutput)
                   .getResponse();
  },
};

// Finds the definition when prompted
const DefinitionHandler = {
  canHandle(handlerInput) {
    console.log("Inside DefinitionHandler");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const request = handlerInput.requestEnvelope.request;

    return attributes.state === states.QUIZ &&
           request.type === 'IntentRequest' &&
           request.intent.name === 'DefinitionIntent';
  },
  async handle(handlerInput) {
    console.log("Inside DefinitionHandler - handle");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const response = handlerInput.responseBuilder;
    
    // Finds the definition using the Merriam-Webster API
    const item = attributes.quizItem;
    const params = {
      hostname: 'dictionaryapi.com',
      path: "/api/v3/references/collegiate/json/" + item.Word + "?key=806f82af-a52a-4a99-b90a-90d73ed91e31",
      port: 443,
      method: 'GET',
    };
    
    const dictResp = await httpGet(params);
    const definition = dictResp[0].def[0].sseq[0][0][1].dt[0][1];
    const formattedDefinition = format(definition);     // Formats the definition for proper output
    return response.speak(formattedDefinition)
                   .reprompt(formattedDefinition)
                   .getResponse();
  }
};

// Repeats the word if asked
const RepeatHandler = {
  canHandle(handlerInput) {
    console.log("Inside RepeatHandler");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const request = handlerInput.requestEnvelope.request;

    return attributes.state === states.QUIZ &&
           request.type === 'IntentRequest' &&
           request.intent.name === 'AMAZON.RepeatIntent';
  },
  handle(handlerInput) {
    console.log("Inside RepeatHandler - handle");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const response = handlerInput.responseBuilder;
    
    const question = getQuestion(attributes.quizitem);

    return response.speak(question)
                   .reprompt(question)
                   .getResponse();
  },
};

// States the instructions again if the user requests help
const HelpHandler = {
  canHandle(handlerInput) {
    console.log("Inside HelpHandler");
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' &&
           request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    console.log("Inside HelpHandler - handle");
    const response = handlerInput.responseBuilder;
    
    return response.speak(helpMessage2)
                   .reprompt(helpMessage2)
                   .getResponse();
  },
};

// Exits the game if prompted
const StopHandler = {
  canHandle(handlerInput) {
    console.log("Inside StopHandler");
    const request = handlerInput.requestEnvelope.request;

    return request.type === `IntentRequest` && (
              request.intent.name === 'AMAZON.StopIntent'
           );
  },
  handle(handlerInput) {
    const response = handlerInput.responseBuilder;
    return response.speak(exitSkillMessage)
                   .getResponse();
  },
};

// Catches everything that fall within the previous handlers
const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    console.log("Inside SessionEndedRequestHandler");
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${JSON.stringify(handlerInput.requestEnvelope)}`);
    const response = handlerInput.responseBuilder;
    return response.getResponse();
  },
};

// Catches errors and produces a message
const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Intent: ${handlerInput.requestEnvelope.request.intent.name}: message: ${error.message}`);
    const response = handlerInput.responseBuilder;
    return response.speak(helpMessage2)
                   .reprompt(helpMessage2)
                   .getResponse();
  },
};


/* CONSTANTS */

const skillBuilder = Alexa.SkillBuilders.custom();

// Messages
const welcomeMessage = `Welcome to the spelling bee! I will give you a word, and ask you to spell it. 
                        If you ever need the definition, simply say define.
                        Make sure to enunciate clearly. Say begin to get the first word.`;
const helpMessage1 = `The rules are the following. I will give you a word, and ask you to spell it. 
                      If you ever need the definition, simply say define.
                      Make sure to enunciate clearly. Say begin to get the first word.`;
const helpMessage2 = `The rules are the following. I will give you a word, and ask you to spell it. 
                      If you ever need the definition, simply say define. Make sure to enunciate clearly.`;
const exitSkillMessage = `Thank you for participating in the spelling bee!  Let's play again soon!`;
const continuation = "Say continue to get a new word.";
                
// List of words
const data = [
  {Word: 'activate'},
  {Word: 'agnomen'},
  {Word: 'alveoli'},
  {Word: 'anorthite'},
  {Word: 'architecture'},
  {Word: 'astronautic'},
  {Word: 'baboon'},
  {Word: 'basophilic'},
  {Word: 'benign'},
  {Word: 'black'},
  {Word: 'booklet'},
  {Word: 'brigadier'},
  {Word: 'bust'},
  {Word: 'cantle'},
  {Word: 'caulk'},
  {Word: 'cheer'},
  {Word: 'circumspect'},
  {Word: 'cocoon'},
  {Word: 'compass'},
  {Word: 'conic'},
  {Word: 'convoy'},
  {Word: 'covalent'},
  {Word: 'cruel'},
  {Word: 'darken'},
  {Word: 'degassing'},
  {Word: 'desist'},
  {Word: 'dill'},
  {Word: 'doff'},
  {Word: 'drunkard'},
  {Word: 'egghead'},
  {Word: 'encumber'},
  {Word: 'esquire'},
  {Word: 'expanse'},
  {Word: 'familiar'},
  {Word: 'filch'},
  {Word: 'floury'},
  {Word: 'fowl'},
  {Word: 'gable'},
  {Word: 'gestalt'},
  {Word: 'goodbye'},
  {Word: 'guanine'},
  {Word: 'happy'},
  {Word: 'hereby'},
  {Word: 'homesick'},
  {Word: 'hustle'},
  {Word: 'impartation'},
  {Word: 'inconstant'},
  {Word: 'influence'},
  {Word: 'intensify'},
  {Word: 'isochronous'},
  {Word: 'kaolinite'},
  {Word: 'laminar'},
  {Word: 'lenticular'},
  {Word: 'lobar'},
  {Word: 'macaque'},
  {Word: 'marinade'},
  {Word: 'memoir'},
  {Word: 'milt'},
  {Word: 'moo'},
  {Word: 'mynah'},
  {Word: 'nickname'},
  {Word: 'oakwood'},
  {Word: 'onrush'},
  {Word: 'oxygenate'},
  {Word: 'participle'},
  {Word: 'peony'},
  {Word: 'phonetic'},
  {Word: 'plank'},
  {Word: 'ponder'},
  {Word: 'preface'},
  {Word: 'promenade'},
  {Word: 'pulley'},
  {Word: 'quirky'},
  {Word: 'receptive'},
  {Word: 'rep'},
  {Word: 'rhapsody'},
  {Word: 'rowboat'},
  {Word: 'sap'},
  {Word: 'scrooge'},
  {Word: 'serfdom'},
  {Word: 'shotbush'},
  {Word: 'sixgun'},
  {Word: 'snatch'},
  {Word: 'southpaw'},
  {Word: 'springy'},
  {Word: 'stereoscopy'},
  {Word: 'stung'},
  {Word: 'surface'},
  {Word: 'tabular'},
  {Word: 'telescope'},
  {Word: 'thirst'},
  {Word: 'tomatoes'},
  {Word: 'transoceanic'},
  {Word: 'tsunami'},
  {Word: 'upend'},
  {Word: 'venture'},
  {Word: 'voluptuous'},
  {Word: 'weird'},
  {Word: 'wishbone'},
  {Word: 'yield'},
];

// Tells if a question is in progress
const states = {
  QUIZ: `_QUIZ`,
};

// Indications for correct/wrong
const speechConsCorrect = ['Booya!', 'All righty!', 'Bam!', 'Bazinga!', 'Bingo!', 'Boom!', 'Bravo!', 'Cha Ching!', 'Cheers!', 'Dynomite!', 'Hip hip hooray!', 'Hurrah!', 'Hurray!', 'Huzzah!', 'Oh dear.  Just kidding.  Hurray!', 'Kaboom!', 'Kaching!', 'Oh snap!', 'Phew!','Righto!', 'Way to go!', 'Well done!', 'Whee!', 'Woo hoo!', 'Yay!', 'Wowza!', 'Yowsa!'];
const speechConsWrong = ['Argh!', 'Aw man!', 'Blarg!', 'Blast!', 'Boo!', 'Bummer!', 'Darn!', "D'oh!", 'Dun dun dun!', 'Eek!', 'Honk!', 'Le sigh!', 'Mamma mia!', 'Oh boy!', 'Oh dear!', 'Oof!', 'Ouch!', 'Ruh roh!', 'Shucks!', 'Uh oh!', 'Wah wah!', 'Whoops a daisy!', 'Yikes!'];


/* FUNCTIONS */

// Returns a random number
function getRandom(min, max) {
  return Math.floor((Math.random() * ((max - min) + 1)) + min);
}

// Sends a request to the API 
function httpGet(options) {
  return new Promise(((resolve, reject) => {
    const request = https.request(options, (response) => {
      response.setEncoding('utf8');
      let returnData = '';

      if (response.statusCode < 200 || response.statusCode >= 300) {
        return reject(new Error(`${response.statusCode}: ${response.req.getHeader('host')} ${response.req.path}`));
      }

      response.on('data', (chunk) => {
        returnData += chunk;
      });

      response.on('end', () => {
        resolve(JSON.parse(returnData));
      });

      response.on('error', (error) => {
        reject(error);
      });
    });
    request.end();
  }));
}

// Formats a definition so it is understandable
function format(definition) {
  var firstBracket;
  var secondBracket;
  var i;
  for (i = definition.length; i > 0; i--) {
    if (definition.substring(i - 1, i) === '}') {
      firstBracket = i - 1;
    }
    if (definition.substring(i - 1, i) === '{') {
      secondBracket = i - 1;
      definition = definition.substring (0, secondBracket) + definition.substring (firstBracket + 1);
      i = definition.length;
    }
  }
  return definition;
} 

// Combines the letters spelled by the user into a single string
function getAnswer(item) {
    var spelling = [ item.Word.substring(0, 1) + '. ' ];
    var i;
    for (i = 1; i < item.Word.length; i++) {
        spelling.push(item.Word.substring(i, i + 1) + '. ');
    }
    
    var finalSpelling = '';
    var j;
    for (j = 0; j < item.Word.length; j++) {
        finalSpelling += spelling[j];
    }
    return `The spelling of ${item.Word} is ` + finalSpelling + `. `;
}

// Formats the next question
function getQuestion(item) {
  return ` Spell ${item.Word}.`;
}

// Finds a random word for the next prompt and asks the questions
function askQuestion(handlerInput) {
  console.log("I am in askQuestion()");
  //GENERATING THE RANDOM QUESTION FROM DATA
  const random = getRandom(0, data.length - 1);
  const item = data[random];

  //GET SESSION ATTRIBUTES
  const attributes = handlerInput.attributesManager.getSessionAttributes();

  //SET QUESTION DATA TO ATTRIBUTES
  attributes.selectedItemIndex = random;
  attributes.quizItem = item;

  //SAVE ATTRIBUTES
  handlerInput.attributesManager.setSessionAttributes(attributes);

  const question = getQuestion(item);
  return question;
}

// Formats the correct/wrong statement
function getSpeechCon(type) {
  if (type) return `<say-as interpret-as='interjection'>${speechConsCorrect[getRandom(0, speechConsCorrect.length - 1)]}! </say-as><break strength='strong'/>`;
  return `<say-as interpret-as='interjection'>${speechConsWrong[getRandom(0, speechConsWrong.length - 1)]} </say-as><break strength='strong'/>`;
}

// Compares the user's answer to the correct answer
function compareSlots(slots, value) {
  console.log('in compareSlots');
  
    var answer = '';
    
    const slotNames = [
      "AnswerA",
      "AnswerB",
      "AnswerC",
      "AnswerD",
      "AnswerE",
      "AnswerF",
      "AnswerG",
      "AnswerH",
      "AnswerI",
      "AnswerJ",
      "AnswerK",
      "AnswerL",
      "AnswerM",
      "AnswerN",
      "AnswerO",
      "AnswerP",
      "AnswerQ",
      "AnswerR",
      "AnswerS",
      "AnswerT",
      "AnswerU",
      "AnswerV",
      "AnswerW",
      "AnswerX"
    ];
    
    slotNames.forEach(slot => {
      console.log(slot);
      if (Object.prototype.hasOwnProperty.call(slots, slot) && slots[slot].value !== undefined) {    
            answer += slots[slot].value.substring(0, 1);
      }
    });
    
    for (var slot in slotNames) {
        if (Object.prototype.hasOwnProperty.call(slots, slot) && slots[slot].value !== undefined) {    
            answer += slots[slot].value.substring(0, 1);
        }
    }
    
    if (answer.toString().toLowerCase() === value.toString().toLowerCase()) {
       return true;
    }
  return false;
}

/* LAMBDA SETUP */
exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    QuizHandler,
    QuizAnswerHandler,
    DefinitionHandler,
    RepeatHandler,
    HelpHandler,
    StopHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
