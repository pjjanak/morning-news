var cast_api,
	cv_activity,
	receiverList,
	$killSwitch = $('.kill'),
	$snooze = $('.snooze'),
	$wake = $('.wake'),
	$startSwitch = $('.set'),
	$wakeTime = $('.wake-time'),
	$fadeTime = $('.fade-time'),
	$snoozeDuration = $('.snooze-duration'),
	$login = $('.login'),
	showCardsTimer = null,
	snoozeTimer = null,
	positionObject = {},
	eventList = [],
	googleOAuthParams = null,
	googleOAuthClientId = '*** GOOGLE OAUTH KEY ***',
	appId = '*** CHROMECAST APP ID ***';

$wakeTime.val(moment().format('YYYY-MM-DDTHH:mm'));

window.addEventListener('message', function(event) {
	if (event.source === window && event.data &&
			event.data.source === 'CastApi' &&
			event.data.event === 'Hello') {

		if (location.hash) {
			googleOAuthParams = getGoogleOAuthParams();
			validateOAuthParams()
				.done(function() {
					initializeApi();
				});
		} else {
			initializeApi();
		}
	}
});

getGoogleOAuthParams = function() {
	var params = {},
		queryString = location.hash.substring(1),
    	regex = /([^&=]+)=([^&]*)/g,
    	m;
	
	while (m = regex.exec(queryString)) {
  		params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
	}

	return params;
};

validateOAuthParams = function() {
	var dfd = $.Deferred();

	if (!googleOAuthParams.error) {
		$.ajax({
			method: 'GET',
			url: 'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + googleOAuthParams.access_token
		}).done(function(response) {
			if (response.audience === googleOAuthClientId) {
				$login.prop('disabled', true);
				dfd.resolve();
			}
			dfd.reject();
		}).fail(function(response) {
			googleOAuthParams = null;
			dfd.reject();
		});
	} else {
		dfd.reject();
	}

	return dfd.promise();
};

initializeApi = function() {
	if (!cast_api) {
		cast_api = new cast.Api();
		cast_api.addReceiverListener(appId, onReceiverList);
	}
};

onReceiverList = function(list) {
	if (list.length > 0) {
		receiverList = list;
		$('.receiver-list').empty();
		receiverList.forEach(function(receiver) {
			$listItem = $('<li><input type="checkbox" value="' + receiver.id + '" class="receiver-option">' + receiver.name + '</input></li>');
			$listItem.on('click', handleReceiverChecked);
			$('.receiver-list').append($listItem);
		});
	}
};

handleReceiverChecked = function(e) {
	$startSwitch.prop('disabled', false);

	if (!googleOAuthParams) {
		$('.card-option:not(.needs-auth)').prop('disabled', false);
	} else {
		$('.card-option').prop('disabled', false);
	}
};

$('.card-option').on('change', function(e) {
	var $target = $(e.target);

	if ($target.is(':checked')) {
		if ($target.val() === 'weather' || $target.val() === 'traffic') {
			if (_.isEmpty(positionObject)) {
				doGeolocation();
			}
		} else if ($target.val() === 'appointments' && eventList.length === 0) {
			$startSwitch.html('Loading event data...').prop('disabled', true);
			doCalendarLogic().done(function() {
				$startSwitch.html('Set Alarm').prop('disabled', false);
			});
		}
	}
});

doCalendarLogic = function() {
	var dfd = $.Deferred();

	getCalendarList()
		.done(function(response) {
			getEventList(response)
				.done(function() {
					dfd.resolve();
				}).fail(function() {
					dfd.reject();
				});
		}).fail(function() {
			dfd.reject();
		});

	return dfd.promise();
};

getCalendarList = function() {
	var dfd = $.Deferred();

	$.ajax({
		method: 'GET',
		url: 'https://www.googleapis.com/calendar/v3/users/me/calendarList?' +
				'maxResults=5&' +
				'minAccessRole=writer&' +
				'access_token=' + googleOAuthParams.access_token
	}).done(function(response) {
		dfd.resolve(response);
	}).fail(function() {
		dfd.reject();
	});

	return dfd.promise();
};

getEventList = function(calendarListResponse) {
	var dfd = $.Deferred(),
		count = 0;

	calendarListResponse.items.forEach(function(calendar, idx, calendarList) {
		$.ajax({
			method: 'GET',
			url: 'https://www.googleapis.com/calendar/v3/calendars/' + calendar.id + '/events?' +
					'maxResults=5&' +
					'timeMin=' + moment().hour(0).minute(0).second(0).format('YYYY-MM-DDTHH:mm:ss.SSSZ') + '&' +
					'timeMax=' + moment().hour(23).minute(59).second(59).format('YYYY-MM-DDTHH:mm:ss.SSSZ') + '&' +
					'access_token=' + googleOAuthParams.access_token 
		}).done(function(response) {
			response.items.forEach(function(item) {
				eventList.push(item);
			});

			if (count === calendarList.length - 1) {
				dfd.resolve();
			}
			count++;
		}).fail(function() {
			dfd.reject();
		});
	});

	return dfd.promise();
};

doGeolocation = function() {
	navigator.geolocation.getCurrentPosition(function(pos) {
		positionObject = {latitude: pos.coords.latitude, longitude: pos.coords.longitude};
	});
};

$startSwitch.on('click', function() {
	var now = moment(),
		then = moment($wakeTime.val());

	$startSwitch.prop('disabled', true);
	$('.card-option').prop('disabled', true);

	setTimeout(alarmWillSound, then.diff(now));
});

alarmWillSound = function() {
	var $target = $('.receiver-option:checked'),
		receiver = _.find(receiverList, function(receiver) {
			return receiver.id === $target.val();
		});

	doLaunch(receiver);
};

doLaunch = function(receiver) {
	if (!cv_activity) {
		var request = new cast.LaunchRequest(appId, receiver);

		$killSwitch.prop('disabled', false);
		$snooze.prop('disabled', false);
		$wake.prop('disabled', false);

		cast_api.launch(request, onLaunch);
	}
};

onLaunch = function(activity) {
	if (activity.status === 'running') {
		cv_activity = activity;
		cast_api.sendMessage(cv_activity.activityId, 'MorningNews', {type: MessageType.BEGIN, fadeTime: $fadeTime.val() * 60});
		startShowCardsTimer($fadeTime.val() * 60000);
	}
};

startShowCardsTimer = function(timeout) {
	showCardsTimer = setTimeout(function() {
		showCards();	
	}, timeout);
};

showCards = function() {
	var cardsArr = [],
		$cardOptions = $('.card-option:checked');

	_.each($cardOptions, function(cardOption) {
		cardsArr.push($(cardOption).val());
	});

	cast_api.sendMessage(cv_activity.activityId, 'MorningNews', {
		type: MessageType.SHOW_CARDS,
		position: positionObject,
		events: eventList,
		cards: cardsArr
	});

	showCardsTimer = null;

	$wake.prop('disabled', true);
};

$killSwitch.on('click', function() {
	cast_api.stopActivity(cv_activity.activityId, function(){});
	cv_activity = null;
	
	$killSwitch.prop('disabled', true);
	handleReceiverChecked();
});

$snooze.on('click', function() {
	cast_api.sendMessage(cv_activity.activityId, 'MorningNews', {type: MessageType.SNOOZE});
	$snooze.prop('disabled', true);
	$wake.prop('disabled', false);

	snoozeTimer = setTimeout(function() {
		cast_api.sendMessage(cv_activity.activityId, 'MorningNews', {type: MessageType.RESUME});
		$snooze.prop('disabled', false);
	}, $snoozeDuration.val() * 60000);
});

$wake.on('click', function() {
	$snooze.prop('disabled', true);
	$wake.prop('disabled', true);

	if (showCardsTimer) clearTimeout(showCardsTimer);
	if (snoozeTimer) clearTimeout(snoozeTimer);

	cast_api.sendMessage(cv_activity.activityId, 'MorningNews', {type: MessageType.WAKE});

	showCards();
});

$login.on('click', function() {
	window.location = 'https://accounts.google.com/o/oauth2/auth?' +
		'response_type=token&' +
		'client_id=' + googleOAuthClientId + '&' +
		'redirect_uri=http://localhost:8080/sender/sender.html&' +
		'scope=https://www.googleapis.com/auth/calendar.readonly';
});