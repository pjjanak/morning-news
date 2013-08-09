$(function() {
	var receiver = new cast.receiver.Receiver('*** CHROMECAST APP ID ***', ['MorningNews']),
		channelHandler = new cast.receiver.ChannelHandler('MorningNews'),
		$messages = $('.messages'),
		$body = $('body'),
		$viewport = $('.viewport'),
		fadeTime = 0;
	
	channelHandler.addChannelFactory(
		receiver.createChannelFactory('MorningNews'));

	receiver.start();

	channelHandler.addEventListener(cast.receiver.Channel.EventType.MESSAGE, onMessage.bind(this));

	function onMessage(event) {
		if (event.message.type === MessageType.BEGIN) {
			fadeTime = event.message.fadeTime;
			$body.css('transition', 'background ' + fadeTime + 's');
			$body.css('background', '#EEE');
		} else if (event.message.type === MessageType.SNOOZE) {
			$('.card').remove();
			$body.css('background', 'black');
			$body.css('transition', '');
		} else if(event.message.type === MessageType.RESUME) {
			$body.css('transition', 'background ' + fadeTime + 's');
			$body.css('background', '#EEE');
		} else if (event.message.type === MessageType.WAKE) {
			$body.css('background', '#EEE');
			$body.css('transition', '');
		} else if (event.message.type === MessageType.SHOW_CARDS) {
			var lat = event.message.position.latitude,
				lon = event.message.position.longitude,
				cards = event.message.cards;

			if (cards.length > 0) {
				var cardElements = generateUI(cards.length);

				if (cards.indexOf(CardType.WEATHER.key) != -1) {
					doWeather(lat, lon, cardElements.shift());
				}

				if (cards.indexOf(CardType.TRAFFIC.key) != -1) {
					doMap(lat, lon, cardElements.shift());
				}

				if (cards.indexOf(CardType.STOCKS.key) != -1) {
					doStocks(/*login,*/ cardElements.shift());
				}

				if (cards.indexOf(CardType.APPOINTMENTS.key) != -1) {
					doAppointments(event.message.events, cardElements.shift());
				}

				$messages.css('opacity', 0);
				$('.card').css('opacity', 1);
			}
		}
	}

	function generateUI(cardCount) {
		var totalWidth = $viewport.width(),
			totalHeight = $viewport.height(),
			numRows = Math.round(cardCount/2), // 2 cards per row
			numCols = cardCount === 1 ? 1 : 2 // handle special case where one card should take up whole space
			cardWidth = totalWidth / numCols - 10,
			cardHeight = totalHeight / numRows - 20,
			rowObjects = [],
			cardObjects = [],
			rowCursor = 0;

		for (var i = 0; i < numRows; i++) {
			var $row = $('<div class="row"></div>');
			$row.appendTo($viewport);
			rowObjects.push($row);
		}

		for (var i = 0; i < cardCount; i++) {
			var $row = rowObjects[rowCursor],
				$card = $('<div class="card" style="width: ' + cardWidth + 'px; height: ' + cardHeight + 'px;"></div>');

			$card.appendTo($row);
			cardObjects.push($card);

			if ($row.children().length == 2) {
				rowCursor++;
			}
		}

		return cardObjects;
	}

	function doWeather(latitude, longitude, $card) {
		$.ajax({
			method: 'GET',
			url: 'http://api.wunderground.com/api/*** WUNDERGROUD API KEY ***/conditions/q/' + latitude + ',' + longitude + '.json',
			dataType: 'jsonp'
		}).done(function(response) {
			var weatherLetter = getCorrectWeatherLetter(response.current_observation.icon)
			$card.html('<div class="content weather">' +
				'<div class="title">Today\'s Forecast</div>' +
				'<span class="weather-icon">' + weatherLetter + '</span><br/>' + response.current_observation.temp_f + '&deg; F' +
				'</div>');
		});
	}

	function doMap(latitude, longitude, $card) {
		$card.html('<div class="content map"></div>');

		google.maps.visualRefresh = true;

		var mapOptions = {
			center: new google.maps.LatLng(latitude, longitude),
			zoom: 12,
			mapTypeId: google.maps.MapTypeId.ROADMAP,
			disableDefaultUI: true
		};
		var map = new google.maps.Map($('.map')[0], mapOptions);

		var trafficLayer = new google.maps.TrafficLayer();
		trafficLayer.setMap(map);
	}

	function doStocks($card) {
		$card.html('<div class="content stocks">Stocks</div>');
	}

	function doAppointments(events, $card) {
		$cardContent = $('<div class="content appointments"><div class="title">Today\'s Appointments</div></div>');

		events.forEach(function(event) {
			var $eventBlurb = $('<div class="event-blurb">' + event.summary + ' @ ' + (event.start.dateTime ? moment(event.start.dateTime).format('hh:mm a') : '') +
				(event.location ? ', ' + event.location : '') + '</div>');
			$cardContent.append($eventBlurb);
		});

		$card.html($cardContent);
	}

	function getCorrectWeatherLetter(iconCode) {
		var letter;

		switch (iconCode) 
		{
		case 'chanceflurries':
			letter = 'V';
			break;
		case 'chancerain':
			letter = 'Q';
			break;
		case 'chancesleet':
			letter = 'X';
			break;
		case 'chancesnow':
			letter = 'V';
			break;
		case 'chancetstorms':
			letter = 'P';
			break;
		case 'clear':
			letter = 'B';
			break;
		case 'cloudy':
			letter = 'N';
			break;
		case 'flurries':
			letter = 'U';
			break;
		case 'fog':
			letter = 'M';
			break;
		case 'hazy':
			letter = 'J';
			break;
		case 'mostlycloudy':
			letter = '3';
			break;
		case 'mostlysunny':
			letter = 'H';
			break;
		case 'partlycloudy':
			letter = '3';
			break;
		case 'partlysunny':
			letter = 'H';
			break;
		case 'sleet':
			letter = 'X';
			break;
		case 'rain':
			letter = 'R';
			break;
		case 'snow':
			letter = 'W';
			break;
		case 'sunny':
			letter = 'B';
			break;
		case 'tstorms':
			letter = 'O';
			break;
		default:
			letter = 'B';
		}

		return letter;
	}
});