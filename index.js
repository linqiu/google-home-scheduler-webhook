var _ = require('lodash');
var moment = require('moment');
var doc = require('dynamodb-doc');
var dynamo = new doc.DynamoDB();
var Promise = require('bluebird');

// globals
var HOLDING_CHECK = 'check.holding';
var STARTIME_CHECK = 'check.starttime';

function getHoldingDate(searchTerm, data) {
  var text = 'You are not scheduled for holding any time soon.';
  var iteratee = _.find(data, function(iteratee) {
    return iteratee.event.toLowerCase() === searchTerm;
  });
  var earliestDate = iteratee ? moment(iteratee.time).format('dddd MMMM Do YYYY') : undefined;

  if(earliestDate) {
    text = 'The next date you are in holding is ' + earliestDate;
  }

  return text;
}

function getNextDayStartTime(vacationTerm, data) {
  var tomorrow = moment().add(1, 'days').format('MMMM Do');
  var text = 'You are not scheduled to work on ' + tomorrow;
  var todayDayOfYear = moment().dayOfYear();
  var earliestStartDate = _.find(data, function(iteratee) {
    var isVacation = iteratee.event.toLowerCase().includes(vacationTerm);

    if (isVacation) {
      return false;
    }
    else {
      var dayOfYear = moment(iteratee.time).dayOfYear();
      return dayOfYear - todayDayOfYear === 1;
    }
  });
  var startTime = undefined;
  var startDate = undefined;

  if(earliestStartDate) {
    startTime = earliestStartDate.start_time;
    startDate = moment(earliestStartDate.time).format('MMMM Do');
  }

  if (startTime && startDate) {
    text = 'Your start time is ' + startTime + ' on ' + startDate;
  }

  return text;
}

function getCalendar() {
  var params = {
    Key: {
      key: 'google-calendar'
    },
    TableName: 'home-integration'
  };

  return new Promise(function(resolve, reject) {
    dynamo.getItem(params, function(err, data) {
      if(err) {
        reject(err);
      }
      else {
        resolve(data.Item);
      }
    });
  });
}

exports.handler = function(event, context, callback) {
  var action = _.get(event, 'result.action', undefined);
  if (_.includes([HOLDING_CHECK, STARTIME_CHECK], action)) {
    getCalendar().then(function(item) {
      var responseText = 'I don\'t know what is happening';

      if (action === HOLDING_CHECK) {
        var searchTerm = item.terms.search.toLowerCase();
        responseText = getHoldingDate(searchTerm, item.data);
      } else {
        var vacationTerm = item.terms.vacation.toLowerCase();
        responseText = getNextDayStartTime(vacationTerm, item.data);
      }

      var payload = {
        speech: responseText,
        displayText: responseText
      };

      callback(null, payload);
    });
  } else {
    callback(null, {
      speech: 'Sorry, I don\'t how to answer that.',
      displayText: 'Sorry, I don\'t how to answer that.'
    });
  }
};