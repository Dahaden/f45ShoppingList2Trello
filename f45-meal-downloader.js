const request = require('request-promise');
const cheerio = require('cheerio');
const tough = require('tough-cookie');
const inquirer = require('inquirer');
const config = require('./config.json');

function nextSunday() {
  const date = new Date();
  date.setDate(date.getDate() + 7  + (7 - date.getDay()) % 7);
  return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
}

const mealUrl2Ingredients = {};

const mealDuringWeek = {};

function makeRequestTof45(uri) {
  const cookie = new tough.Cookie({
    key: "wordpress_logged_in_4514f4c95b37582429c03356644c7ce7",
    value: config.f45Cookie,
    domain: 'f45challenge.com',
    path: '/',
  });
  
  const cookiejar = request.jar();
  cookiejar.setCookie(cookie, 'https://f45challenge.com');
  
  const options = {
    uri,
    jar: cookiejar
  };

  return request(options);
}

const decimalRegex = /^(\d+)(\s.*)/;
const fractionRegex = /^(\d+)\/(\d+)(\s.*)/;

function splitIngredientText(ingredientRaw) {
  if (decimalRegex.test(ingredientRaw)) {
    const match = ingredientRaw.match(decimalRegex);
    // console.log(match);
    return {
      amount: match[1],
      text: match[2],
    }
  } else if (fractionRegex.test(ingredientRaw)) {
    const match = ingredientRaw.match(fractionRegex);
    // console.log(match);
    // console.log('Fraction:', match[1] / match[2]);
    return {
      amount: match[1] / match[2],
      text: match[3],
    }
  } else {
    return {
      amount: 1,
      text: ingredientRaw,
    }
  }
}

function getReciepeDetails(url) {
  return makeRequestTof45(url).then(r => {
    const $ = cheerio.load(r);

    const serves = $('.receipe_serves > span > strong').text();

    const ingredientsList = $('.ingredients > ul > li').toArray();

    // console.log('List:', ingredientsList);

    const ingredientsText = ingredientsList.map(li => $(li).text() );

    // console.log('Serves:', serves);
    // console.log('Ingredients:', ingredientsText);

    return {
      serves,
      ingredients: ingredientsText.map(splitIngredientText),      
    };
  });
}

const mealTextRegex = /([^()]+) \(leftover\)/;

function getMealText(mealRaw) {
  if (mealTextRegex.test(mealRaw)) {
    const match = mealRaw.match(mealTextRegex);
    return match[1];
  } else {
    return mealRaw;
  }
}

function getServesForMeal() {}

function getLatestShoppingList() {

  const dow = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  const meals = [
    'Breakfast',
    'AM snack',
    'Lunch',
    'PM snack',
    'Dinner',
  ];

  const mealToIngredients = {};

  const mealsForTheWeek = {};

  makeRequestTof45('https://f45challenge.com/meals-plans/?cusine=Mainstream&is_next=' + nextSunday()).then(r => {
    const $ = cheerio.load(r);

    const mealLinks = Array.from($('.meal .col-sm-5 a'));

    let promiseChain = Promise.resolve();

    for (const day of dow) {
      for (const meal of meals) {
        mealLinks.shift(); // First is an img url, second is link text.
        const mealLink = mealLinks.shift();

        // console.log('Meal a link:', mealLink);

        const text = getMealText($(mealLink.children[0]).text());
        const url = $(mealLink).attr('href');

        // console.log('Meal name:', text);
        // console.log('Meal url:', url);

        if (mealToIngredients[text.toLowerCase()] === undefined) {
          mealToIngredients[text.toLowerCase()] = {};
          promiseChain = promiseChain.then(() =>
            getReciepeDetails(url).then(r => mealToIngredients[text.toLowerCase()] = {...r, name: text})
          );
        }

        if (mealsForTheWeek[day] === undefined) {
          mealsForTheWeek[day] = { };
        }

        mealsForTheWeek[day][meal] = {
          name: text,
        };
      }
    }

    promiseChain.then(() => {
      console.log(JSON.stringify(mealsForTheWeek, null, 2));
      console.log(JSON.stringify(mealToIngredients, null, 2));
      for (const day in mealsForTheWeek) {
        for (const meal in mealsForTheWeek[day]) {

        }
      }
    })

    // const shoppingListContent = $('.shopping-list-content')[0];
    
    // let type = '';
    // const shoppingList = {};

    // shoppingListContent.children.forEach(e => {
    //   switch(e.name) {
    //     case 'p':
    //       type = $(e).text();
    //       break;
    //     case 'ul':
    //       shoppingList[type] = e.children.map(i => $(i).text()).filter(t => t !== '\n');
    //       break;
    //   };

    // });
    // return shoppingList;
  }).catch(e => console.log('something went wrong', e));
}

getLatestShoppingList();