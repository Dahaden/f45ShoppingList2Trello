const Trello = require('trello');
const request = require('request-promise');
const cheerio = require('cheerio');
const tough = require('tough-cookie');
const config = require('./config.json');

const key = config.trello.key;
const token = config.trello.token;

const boardId = config.trello.boardId;

function nextSunday() {
  const date = new Date();
  date.setDate(date.getDate() + 7  + (7 - date.getDay()) % 7);
  return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
}

function getLatestShoppingList() {
  const cookie = new tough.Cookie({
    key: "wordpress_logged_in_4514f4c95b37582429c03356644c7ce7",
    value: config.f45Cookie,
    domain: 'f45challenge.com',
    path: '/'
  });
  
  const cookiejar = request.jar();
  cookiejar.setCookie(cookie, 'https://f45challenge.com');
  
  const options = {
    uri: 'https://f45challenge.com/shopping-list/?cusine=Mainstream&is_next=' + nextSunday(),
    jar: cookiejar
  };

  return request(options).then(r => {
    const $ = cheerio.load(r);
    const shoppingListContent = $('.shopping-list-content')[0];

    if (shoppingListContent === undefined) {
      console.log('No data received.');
      console.log('You probably need to refresh your cookies.')
      return;
    }
    
    let type = '';
    const shoppingList = {};

    shoppingListContent.children.forEach(e => {
      switch(e.name) {
        case 'p':
          type = $(e).text();
          break;
        case 'ul':
          shoppingList[type] = e.children.map(i => $(i).text()).filter(t => t !== '\n');
          break;
      };

    });
    return shoppingList;
  }).catch(e => console.log('something went wrong', e));
}

const trello = new Trello(key, token);

async function getTrelloList(listName, existingLists) {
  const list = existingLists.find(l => l.name === listName);
  if (list) {
    return list.id;
  }
  const listRes = await trello.addListToBoard(boardId, listName);
  return listRes.id;
}

async function uploadToTrello() {
  const shoppingList = await getLatestShoppingList();
  const existingLists = await trello.getListsOnBoard(boardId);
  for(let type in shoppingList) {
    console.log('List:', type);
    const listId = await getTrelloList(type, existingLists);

    for(let item of shoppingList[type]) {
      console.log('Item:', item);
      const cardRes = await trello.addCard(item, '', listId);
    }
  }
}
uploadToTrello();