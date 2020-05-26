wrapper().catch(e => {
  console.error("RUNNER ERROR");
  console.error(e);
});

async function wrapper() {
  $ = artoo.$;

  let currentStory = null;
  artoo.ajaxSniffer.after((req, res) => {
    if (req.url.startsWith("https://stories.duolingo.com/api2/stories/")) {
      console.log("Request:", req, res);
      currentStory = res.data.elements;
    }
  });

  while (true) {
    const stories = $("a.story .title");
    const index = Math.floor(Math.random() * stories.length);
    const story = $(stories[index]);
    console.log(`Clicking on a story: ${story.text()}`);
    story.click();
    await wait(2000);
    let prevStep = null;
    for (const step of currentStory) {
      await runStep(step, prevStep);
      prevStep = step;
    }
    console.log("Finished a story!");
    await continueUntilCatalog();
  }
}

async function continueUntilCatalog() {
  const $ = artoo.$;
  await tryUntilDone(() => {
    const catalog = $("a.story .title");
    if (catalog.length) {
      return true;
    } else {
      const button = $(".continue:not([disabled])");
      button.click();
    }
  });
}

async function wait(base, extra) {
  await new Promise(r => setTimeout(r, getRandomTime(base, extra)));
}

function getRandomTime(base, extra = 1000) {
  return base + Math.random() * extra;
}

async function runStep(step, prevStep) {
  console.log("Running:", step);
  if (step.type === "LINE") {
    if (prevStep && prevStep.type === "CHALLENGE_PROMPT") {
      console.log("Awaiting challenge...");
    } else {
      console.log(`Clicking continue...`);
      await clickContinue();
    }
  } else if (step.type === "MULTIPLE_CHOICE") {
    const phrase = step.answers[step.correctAnswerIndex].text;
    console.log(`Clicking phrase "${phrase}"`);
    await clickAnswer(phrase);
    await clickContinue();
  } else if (step.type === "CHALLENGE_PROMPT") {
    console.log("Entering challenge mode");
  } else if (step.type === "SELECT_PHRASE") {
    const phrase = step.answers[step.correctAnswerIndex];
    console.log(`Clicking phrase "${phrase}"`);
    await clickAnswer(phrase);
    await clickContinue();
  } else if (step.type === "POINT_TO_PHRASE") {
    const options = step.transcriptParts.filter(p => p.selectable);
    const phrase = options[step.correctAnswerIndex].text;
    console.log(`Clicking phrase "${phrase}"`);
    await clickAnswer(phrase);
    await clickContinue();
  } else if (step.type === "ARRANGE") {
    const phrases = step.phraseOrder.map(
      index => step.selectablePhrases[index]
    );
    for (const phrase of phrases) {
      console.log(`Clicking phrase "${phrase}"`);
      await clickAnswer(phrase);
    }
    await clickContinue();
  } else if (step.type === "MATCH") {
    for (const { phrase, translation } of step.fallbackHints) {
      console.log(`Clicking pair "${phrase}" - "${translation}"`);
      await clickAnswer(phrase);
      await clickAnswer(translation);
    }
    await clickContinue();
  }
}

async function findAnswers() {
  const $ = artoo.$;
  return tryUntilDone(() => {
    let answers = $(".challenge-container li");
    if (!answers.length) {
      answers = $(".challenge-container .tappable-phrase");
    }
    if (!answers.length) {
      answers = $(".challenge-container .phrase-bank .phrase");
    }
    if (answers.length) {
      return answers;
    }
  });
}

async function findAnswer(text) {
  const $ = artoo.$;
  const answers = await findAnswers();
  console.log(answers);
  const answer = answers.filter(function () {
    const selected = $(this).find(".match-selected").length !== 0;
    return !selected && $(this).text() === text;
  });
  return $(answer[0]);
}

async function clickAnswer(text) {
  const answer = await findAnswer(text);
  const target = answer.children()[0] || answer;
  artoo.$(target).click();
}

async function clickContinue() {
  await click(".continue:not([disabled])");
}

async function tryUntilDone(callback) {
  return new Promise(resolve => {
    const id = setInterval(() => {
      const result = callback();
      if (result) {
        clearInterval(id);
        resolve(result);
      }
    }, getRandomTime(250, 1000));
  });
}

async function click(selector) {
  await tryUntilDone(() => {
    const button = artoo.$(selector);
    if (button.length) {
      button.click();
      return true;
    } else {
      console.log("Could not find selector, retrying...", selector);
    }
  });
}
