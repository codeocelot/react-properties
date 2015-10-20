var app = angular.module('property-search', ['ngResource', 'ngSanitize'], function ($locationProvider) {
    $locationProvider.html5Mode(true);
});

app.filter('htmlToPlaintext', function() {
    return function(text) {
      return  text ? String(text).replace(/<[^>]+>/gm, '') : '';
    };
  }
);

// app.filter('renderSpclChars',function(){
//   return function(text)
//   {
//     var entities = [
//         ['apos', '\''],
//         ['amp', '&'],
//         ['lt', '<'],
//         ['gt', '>'],
//         ['&#39;',''],
//         ['','&#39;']
//     ];
//
//     for (var i = 0, max = entities.length; i < max; ++i)
//         text = text.replace(new RegExp('&'+entities[i][0]+';', 'g'), entities[i][1]);
//
//     return text;
//   }
// })

app.filter('range', function () {
    return function (input, start, end) {
        end = Math.floor(end);
        for (var i = start; i < end; i++)
            input.push(i);
        return input;
    };
});

app.filter("propertyFilter", function () {
    return function (properties, numAdults, numKids) {
        return _.filter(properties,function(el){
            return el["MaxOccupants"] >= (Number(numAdults) + Number(numKids))
        })
    }
});


app.filter("roomsFilter", function () {
    return function (properties,numRooms) {
        return _.filter(properties, function (el) {
            if (numRooms === 0) return true;
            return numRooms === el["NumberBedrooms"]
        })
    }
});


app.filter("imageSize", function () {
    return function (url, size) {
        return url.replace("."+getFileExtension(url), "_" + size + "." + getFileExtension(url))
    }
})

function getFileExtension(i) {
    if (i.indexOf('.') === 0) return i.slice(1, i.length)
    return i.slice(i.indexOf('.')).slice(1, i.length - 1)
}

//app.config(function(uiGmapGoogleMapApi) {
//    uiGmapGoogleMapApi.configure({
//        //    key: 'your api key',
//        v: '3.17',
//        libraries: 'weather,geometry,visualization'
//    });
//})

app.controller('destination-list',["$scope","$resource", function ($scope,$resource) {
    var dests = $resource('http://api.leavetown.com/v2/activeDestinations');
    dests.query(function (newDestinations) {
        // order them into provinces
        $scope.provinces = _.groupBy(newDestinations, function (el) {
            return el['Province'];
        });
        $scope.provinces = _.toArray($scope.provinces)
        var max = 0;
        $scope.provinces.forEach(function (el, i) {
            el.max = false;
            max = (el.length > $scope.provinces[max].length) ? i : max;
            el.forEach(function (el2, i2) {
                el2.URL = el2.Name.replace(' ','-') + "-properties.aspx"
            })
        })
        $scope.provinces[max].active = true;
    })

    $scope.activate = function(province){
        $scope.provinces.forEach(function(el,i){
            if (el === province) {
                el.active = true;
            }
            else el.active = false;
        });
    };
}])

app.controller("resort-detail-controller", ["$scope","$rootScope", "$sce", "$location", "propertyFactory", "contactFactory", function ($scope,$rootScope, $sce, $location, propertyFactory,contactFactory) {
    var qs = $location.search();
    $scope.query = $scope.query || {};
    if (qs['checkin'] === true) qs['checkin'] = '';
    if (qs['checkout'] === true) qs['checkout'] = '';
    $scope.query.checkin = qs["checkin"] || getCookie('checkin');
    $scope.query.checkout = qs["checkout"] || getCookie('checkout');
    $scope.query.checkin = $scope.query.checkin || '';
    $scope.query.checkout = $scope.query.checkout || '';
    if ($scope.query.checkin) setCookie("checkin", $scope.query.checkin, 3);
    if ($scope.query.checkout) setCookie("checkout", $scope.query.checkout, 3);
    if (qs['children']) setCookie('children', qs['children'], 3);
    if (qs['adults']) setCookie('adults', qs['adults'], 3);
    $scope.query.Kids = Number(getCookie('children')) || Number(qs["children"]);
    $scope.query.Adults = Number(getCookie('adults')) || Number(qs["adults"]);
    $scope.query.Kids = $scope.query.Kids || 0;
    $scope.query.Adults = $scope.query.Adults || 2;
    $scope.query.Bedrooms = qs['bedrooms'] || '0';
    $scope.query.badDates = false;
    $scope.contactData = $scope.contactData || {};

    $scope.resortID = qs.resortid;

    propertyFactory.getFromResort($scope.resortID, $scope.query.checkin, $scope.query.checkout).then(
        //-- Table0: Destination
        //-- Table1: Resort
        //-- Table2: Properties
        //-- Table3: Activities
        //-- Table4: Amenties
        //-- Table5: Policies
        //-- Table6: Images
        function (data) {
            $scope.destination = data[0];
            $scope.resort = data[1];
            $scope.properties = data[2];
            $scope.activities = data[3];
            $scope.amenities = data[4];
            $scope.policies = data[5];
            $scope.images = data[6];
            $scope.loves = data[7];
            $scope.resortImages = _.pluck($scope.images, 'URL');

            plotMapPoints(+$scope.resort.Latitude, +$scope.resort.Longitude, $scope.resort.ResortName);

        }
    );

    $scope.setContactForm = function (propertyName) {
        $scope.contactData = $scope.contactData || {};
        $scope.contactData.propertyName = propertyName;

    }

    $scope.sendInquiry = function () {
        var content = {};
        content["name"] = $scope.contactData.name;
        content["source"] = $scope.contactData.source;
        content["email"] = $scope.contactData.email;
        content["phone"] = $scope.contactData.phone;
        content["dayIn"] = $scope.query.checkin;
        content["dayOut"] = $scope.query.checkout;
        content["numberAdults"] = $scope.query.Adults;
        content["numberChildren"] = $scope.query.Kids;
        content["numberPets"] = $scope.contactData.numberPets;
        content["enquiry"] = $scope.contactData.enquiry;
        content["resortName"] = $scope.resort.ResortName;
        content["propertyName"] = $scope.contactData.propertyName;
        contactFactory.post(content)
            .success(function () {
                $("#divAjaxLoading").hide();
                $("#divEnquiry").hide();
                $(".gform_footer").hide();
                $("#divSendComplete").show();
        });
    }

    function plotMapPoints(lat, lng, content, airportLat, airportLng,airportContent) {
        myLatlng = new google.maps.LatLng(lat, lng);
        var mapOptions = {
            center: myLatlng,
            zoom: 16
        };
        map = new google.maps.Map($("#map-canvas")[0],
                  mapOptions);
        var marker = new google.maps.Marker({
            position: myLatlng,
            map: map,
            title: content
        });
        var infowindow = new google.maps.InfoWindow();
        google.maps.event.addListener(marker, 'click', (function (marker, content, infowindow) {
            return function () {
                infowindow.setContent(content);
                infowindow.open(map, marker);
                map.setCenter(marker.getPosition());
            };
        })(marker, content, infowindow));

        //Airport

        if (airportLat && airportLng && airportContent) {
            var myLatlng1 = new google.maps.LatLng(airportLat, airportLng);
            marker = new google.maps.Marker({
                position: myLatlng1,
                map: map,
                title: airportContent
            });
            infowindow = new google.maps.InfoWindow();
            google.maps.event.addListener(marker, 'click', (function (marker, airportContent, infowindow) {
                return function () {
                    infowindow.setContent(airportContent);
                    infowindow.open(map, marker);
                    map.setCenter(marker.getPosition());
                };
            })(marker, airportContent, infowindow));
        }

        $(".MapClick").click(function () {
            $("#GoogleMap").show();
            google.maps.event.trigger(map, "resize");
            google.maps.event.addListener(map, 'zoom_changed', function () {
                map.setCenter(myLatlng);
            });
            map.setCenter(myLatlng);
        });

        $(".MapUnClick").click(function () {

            $("#GoogleMap").hide();
        });
    }

    $scope.ratingWidth = function () {
        return function (resort) {
            return "percent-" + resort["TripAdvisorTotalRatings"] * 20
        }
    }

    $scope.updateAvailability = function () {
        if (!($scope.query.checkin && $scope.query.checkout)) return;
        if ($scope.query.checkout <= $scope.query.checkin) return;
        propertyFactory.getFromResort($scope.resortID, $scope.query.checkin, $scope.query.checkout).then(
            function (data) {
                $scope.destination = data[0];
                $scope.resort = data[1];
                $scope.properties = data[2];
                $scope.activities = data[3];
                $scope.amenities = data[4];
                $scope.policies = data[5];
                $scope.images = data[6];
                $scope.resortImages = _.pluck($scope.images, 'URL');
            }
        )
    }

    $scope.$watch(
          function () { return $scope.query.checkin; },
          function (newValue, oldValue) {
              if ($scope.query.checkout === '' && $scope.query.checkin !== '') {
                  var newDate = new Date($scope.query.checkin);
                  newDate.setDate(newDate.getDate() + 3);
                  $scope.query.checkout = Number(newDate.getMonth() + 1) + "/" + newDate.getDate() + "/" + newDate.getFullYear();
              };
              if ((new Date($scope.query.checkin) >= (new Date($scope.query.checkout)))) {
                  $scope.query.badDates = true;
                  $scope.query.error = "Checkout date must be a later date than checkin";
                  return;
              }
              // two day min
              //var twoDay = new Date($scope.query.checkin);
              //twoDay.setDate(twoDay.getDate() + 1)
              //if (twoDay.toString() === (new Date($scope.query.checkout)).toString()) {
              //    $scope.query.badDates = true;
              //    $scope.query.error = "Two night stay required";
              //    return;
              //}
              if (newValue !== oldValue) {
                  $scope.query.badDates = false;
                  $scope.updateAvailability();
                  setCookie('checkin', newValue, 3);
                  setCookie('checkout',$scope.query.checkout,3)
              }
          }
);

    $scope.$watch(
          function () { return $scope.query.checkout; },
          function (newValue, oldValue) {
              if ($scope.query.checkin === '' && $scope.query.checkout !== '') {
                  var newDate = new Date($scope.query.checkout);
                  newDate.setDate(newDate.getDate() - 3);
                  $scope.query.checkin = Number(newDate.getMonth() + 1) + "/" + newDate.getDate() + "/" + newDate.getFullYear();
              };
              if ((new Date($scope.query.checkin) >= (new Date($scope.query.checkout)))) {
                  $scope.query.badDates = true;
                  $scope.query.error = "Checkout date must be a later date than checkin";
                  return;
              }
              // two day min
              //var twoDay = new Date($scope.query.checkin);
              //twoDay.setDate(twoDay.getDate()+1)
              //if (twoDay.toString() === (new Date($scope.query.checkout)).toString()) {
              //    $scope.query.badDates = true;
              //    $scope.query.error = "Two night stay required";
              //    return;
              //}
              if (newValue !== oldValue) {
                  $scope.query.badDates = false;
                  $scope.updateAvailability();
                  setCookie('checkout', newValue, 3);
                  setCookie('checkin', $scope.query.checkin, 3);
              }
          }
    );

    $scope.extraPersonCharge = function (property) {
        var charge;
        var extraPeople = Number($scope.query.Adults) - property["StandardOccupants"];
        if (extraPeople <= 0) return 0;
        charge = extraPeople * Number(property["ExtraAdultFee"]);
        return charge;
    }

    $scope.totalGuests = function (numAdults, numKids) {
        return function (prop) { if ((Number(numAdults) + Number(numKids)) <= Number(prop["MaxOccupants"])) return true; };
    }

    $scope.roomsFilter = function () {
        return function (prop) {
            if ($scope.query.Bedrooms === '0') return true;
            else if (Number($scope.query.Bedrooms) == prop["NumberBedrooms"]) return true;
        }
    }

    $scope.toTrustedHtml = function (html) {
        return $sce.trustAsHtml(html);
    }

    $scope.greaterThan = function (prop, val) {
        return function (item) {
            if (item[prop] > val) return true;
        }
    }

    $scope.lessThan = function (prop, val) {
        return function (item) {
            if (item[prop] < val) return true;
        }
    }

}]);


app.controller("property-search-controller", ["$scope", "$sce", "$location","activityFactory","propertyFactory", function ($scope, $sce, $location, activityFactory,propertyFactory) {
    var qs = $location.search();
    $scope.query = $scope.query || {};

    var t = new Date();
    var currentDateString = Number(t.getMonth() + 1) + '-' + t.getDate() + '-' + t.getFullYear()

    if (qs['checkin'] === true) qs['checkin'] = '';
    if (qs['checkout'] === true) qs['checkout'] = '';
    $scope.query.checkin = qs["checkin"] || getCookie('checkin')
    $scope.query.checkout = qs["checkout"] || getCookie('checkout')
    $scope.query.checkin = $scope.query.checkin || '';
    $scope.query.checkout = $scope.query.checkout || '';
    if ($scope.query.checkin) setCookie("checkin", $scope.query.checkin, 3);
    if ($scope.query.checkout) setCookie("checkout", $scope.query.checkout, 3);
    $scope.query.Bedrooms = '0';
    if (qs['children']) setCookie('children', qs['children'], 3);
    if (qs['adults']) setCookie('adults', qs['adults'], 3);
    $scope.query.Kids = Number(qs["children"]) || Number(getCookie('children'));
    $scope.query.Adults = Number(qs["adults"]) || Number(getCookie('adults'));
    $scope.query.Kids = $scope.query.Kids || 0;
    $scope.query.Adults = $scope.query.Adults || 2;
    $scope.query.badDates = false;

    var sDate = new Date();
    $('.daterangepicker input[name="daterange"]').daterangepicker(
        {
          locale:{cancelLabel:''},
          parentEl:'#dateSelect',
          minDate: moment(),
          opens:'left',
        },
        function(start, end, label) {
          console.log('New date range selected: ' + start.format('YYYY-MM-DD') + ' to ' + end.format('YYYY-MM-DD') + ' (predefined range: ' + label + ')');
          $scope.query.checkin = start.format('MM-DD-YYYY');
          $scope.query.checkout = end.format('MM-DD-YYYY');

          $scope.updateAvailability();
          setCookie('checkin', end.format('MM-DD-YYYY'), 3);
          setCookie('checkout', end.format('MM-DD-YYYY'), 3);


    });
    $('.daterangepicker input[name="daterange"]').on('cancel.daterangepicker', function(ev, picker) {
        //do something, like clearing an input
        $('.daterangepicker input[name="daterange"]').val('');
    });

    propertyFactory.getFromDestination('canmore',$scope.query.checkin,$scope.query.checkout).then(function (d) {
        // get google map
        $scope.properties = d[0];
        $scope.resorts = d[1];
        $scope.destination = d[2];
        $scope.images = d[3];

        var lats = _.pluck($scope.resorts, 'Latitude');
        var lngs = _.pluck($scope.resorts, 'Longitude');
        var avgLat = 0;
        var avgLng = 0;
        _.each(lats, function (lat) {
            avgLat += +lat;
        })
        _.each(lngs, function (lng) {
            avgLng += +lng;
        })

        avgLat /= lats.length;
        avgLng /= lngs.length;

        // var centre = { lat: avgLat, lng: avgLng };
        // var moptions = { zoom:12, center: new google.maps.LatLng(centre.lat,centre.lng)}
        // var map = new google.maps.Map($('#map-canvas')[0], moptions)

        // $scope.resorts.forEach(function (el) {
        //     var latlong = new google.maps.LatLng(+el.Latitude, +el.Longitude);
        //     var marker = new google.maps.Marker({
        //         position: latlong,
        //         map: map,
        //         title: el.ResortName
        //     });
        //
        //     var infowindow = new google.maps.InfoWindow()
        //
        //     google.maps.event.addListener(marker, 'click', (function (marker, content, infowindow) {
        //         return function () {
        //             infowindow.setContent(content);
        //             infowindow.open(map, marker);
        //         };
        //     })(marker, el.ResortName, infowindow));
        //
        // });
    })

    activityFactory.get('canmore').then(function (activities) {

        $scope.activities = activities.data[0];
        var imgs = activities.data[1];
        $scope.activities.forEach(function (activity, i) {
            activity.images = _.where(imgs, { RefID: activity.ID });
        })

    })
    $scope.deliberatelyTrustDangerousSnippet = function() {
                   return $sce.trustAsHtml($scope.snippet);
                 };

    $scope.clearSelection = function () {
        $scope.query.Adults = 2;
        $scope.query.Kids = 0;
        $scope.query.checkin = '';
        $scope.query.checkout = '';
        $scope.query.Bedrooms = '0';
        // rm cookies
        rmCookie('checkin');
        rmCookie('checkout');
        rmCookie('adults');
        rmCookie('children');
        $scope.updateAvailability();

    }

    $scope.$watch(
      function () { return $scope.query.checkin; },
      function (newValue, oldValue) {
          if ($scope.query.checkout === '' && $scope.query.checkin !== '') {
              var newDate = new Date($scope.query.checkin);
              newDate.setDate(newDate.getDate() + 3);
              $scope.query.checkout = Number(newDate.getMonth() + 1) + "/" + newDate.getDate() + "/" + newDate.getFullYear();
          };
          if ((new Date($scope.query.checkin) >= (new Date($scope.query.checkout)))) {
              $scope.query.badDates = true;
              $scope.query.error = "Checkout date must be a later date than checkin";
              return;
          }
          //var twoDay = new Date($scope.query.checkin);
          //twoDay.setDate(twoDay.getDate() + 1)
          //if (twoDay.toString() === (new Date($scope.query.checkout)).toString()) {
          //    $scope.query.badDates = true;
          //    $scope.query.error = "Two night stay required";
          //    return;
          //}
          if (newValue !== oldValue) {
              $scope.query.badDates = false;
              $scope.updateAvailability();
              setCookie('checkin', newValue, 3)
          }
      }
    );

    $scope.$watch(
      function () { return $scope.query.checkout; },
      function (newValue, oldValue) {
          if ($scope.query.checkin === '' && $scope.query.checkout !== '') {
              var newDate = new Date($scope.query.checkout);
              newDate.setDate(newDate.getDate() - 3);
              $scope.query.checkin = Number(newDate.getMonth() + 1) + "/" + newDate.getDate() + "/" + newDate.getFullYear();
          };
          if ((new Date($scope.query.checkin) >= (new Date($scope.query.checkout)))) {
              $scope.query.badDates = true;
              $scope.query.error = "Checkout date must be a later date than checkin";
              return;
          }
          //var twoDay = new Date($scope.query.checkin);
          //twoDay.setDate(twoDay.getDate() + 1)
          //if (twoDay.toString() === (new Date($scope.query.checkout)).toString()) {
          //    $scope.query.badDates = true;
          //    $scope.query.error = "Two night stay required";
          //    return;
          //}
          if (newValue !== oldValue) {
              $scope.query.badDates = false;
              $scope.updateAvailability();
              setCookie('checkout', newValue, 3)
          }
      }
    );

    $scope.numGuests = function () { return Number($scope.query.Adults) + Number($scope.query.Kids) }

    $scope.updateAvailability = function () {
        propertyFactory.getFromDestination('canmore', $scope.query.checkin, $scope.query.checkout).then(function (d) {
            $scope.properties = d[0];
            $scope.resorts = d[1];
            $scope.destination = d[2];
            $scope.images = d[3];

            if ($scope.resorts && $scope.resorts.length) {
                // var centre = { lat: +$scope.resorts[0].Latitude, lng: +$scope.resorts[0].Longitude };
                // var moptions = { zoom: 12, center: new google.maps.LatLng(centre.lat, centre.lng) }
                // var map = new google.maps.Map($('#map-canvas')[0], moptions)
                //
                // $scope.resorts.forEach(function (el) {
                //     var latlong = new google.maps.LatLng(+el.Latitude, +el.Longitude);
                //     var marker = new google.maps.Marker({
                //         position: latlong,
                //         map: map,
                //         title: el.ResortName
                //     });
                //
                //     var infowindow = new google.maps.InfoWindow()
                //
                //     google.maps.event.addListener(marker, 'click', (function (marker, content, infowindow) {
                //         return function () {
                //             infowindow.setContent(content);
                //             infowindow.open(map, marker);
                //         };
                //     })(marker, el.ResortName, infowindow));
                //
                // });
            }
        })
    }

    $scope.minrate = function (resort) {
        var filteredProperties = _.filter(resort.properties, function (property) {
            var boolRooms = false;
            if (property['MinRate'] == 0) return false;
            if ($scope.query.Bedrooms === '0') boolRooms = true;
            else if ((Number($scope.query.Bedrooms)) == property["NumberBedrooms"]) boolRooms = true;
            return (property["MaxOccupants"] >= (Number($scope.query.Kids) + Number($scope.query.Adults))) && boolRooms;
        });
        var min = _.min(filteredProperties, function (property) {
            var extraPeople = Number($scope.query.Adults) - property["StandardOccupants"];
            var charge = 0;
            if (extraPeople > 0) charge = extraPeople * Number(property["ExtraAdultFee"]);
            return property["MinRate"] + charge;
        });
        var extraPeople = Number($scope.query.Adults) - min["StandardOccupants"];
        var charge = 0;
        if (extraPeople > 0) charge = extraPeople * Number(min["ExtraAdultFee"]);
        return min["MinRate"] + charge;
    }

    $scope.totalGuests = function (numAdults, numKids) {
        return function (prop) {
            if (!prop.properties) return {};
            var g = false;
            prop.properties.forEach(function (el, i) {
                if (el["MaxOccupants"] >= (Number(numAdults) + Number(numKids))) g = true;
            });
            return g;
        }
    }

    $scope.updateRooms = function () {
        return function (resort) {
            var g = false;
            if ($scope.query.Bedrooms === '0') return true;
            resort.properties.forEach(function (el, i) {
                if (el["NumberBedrooms"] === +$scope.query.Bedrooms)
                    g = true;
            });
            return g;
        }
    }

    $scope.extraPersonCharge = function (property) {
        var charge;
        var extraPeople = Number($scope.query.Adults) - property["StandardOccupants"];
        if (extraPeople <= 0) return 0;
        charge = extraPeople * Number(property["ExtraAdultFee"]);
        return charge;
    }

    $scope.propertyFilter = function () {
        return function (prop) {

            if (prop["MaxOccupants"] >= ($scope.query.Kids + $scope.query.Adults)) return true;

        }
    }

    $scope.roomsFilter = function () {
        return function (prop) {
            if ($scope.query.Bedrooms === '0') return true;
            if (prop.NumberBedrooms == +$scope.query.Bedrooms) return true;
        }
    }


    //$scope.availabilityFilter = function () {
    //    return function (prop) {
    //        if (!prop.Availability) return false;
    //        return ( prop.Availability[0] !== 'X' ) ;
    //    }
    //}

    //$scope.resortAvailability = function () {
    //    return function (resort) {
    //        if (!resort.properties) return false;
    //        _.find(resort.properties, function (el) {
    //            return $scope.availabilityFilter()(el);
    //        })
    //        //resort.properties.forEach(function (el, i) {
    //        //    return $scope.availabilityFilter()(el);
    //        //});
    //    }
    //}


    $scope.strSplit = function (str) {
        return str.split(",")
    }

}]);

app.controller("property-search-detail-ctrl", ["$scope","$filter", function ($scope,$filter) {
    $scope.$watch(
        function () {
            return $scope.$parent.query
        },
        function (newValue, oldValue) {
            var numAdults = $scope.$parent.query.Adults;
            var numKids = $scope.$parent.query.Kids;
            var numRooms = Number($scope.$parent.query.Bedrooms);
            var properties = $filter('propertyFilter')($scope.resort.properties, numAdults, numKids);
            properties = $filter('roomsFilter')(properties, numRooms);
            $scope.minBed = _.min(properties, 'NumberBedrooms')["NumberBedrooms"];
            $scope.maxBed = _.max(properties, 'NumberBedrooms')["NumberBedrooms"];
            $scope.minBath = _.min(properties, 'NumberBathrooms')["NumberBathrooms"];
            $scope.maxBath = _.max(properties, 'NumberBathrooms')["NumberBathrooms"];
            $scope.minPeople = _.min(properties, 'MaxOccupants')["MaxOccupants"];
            $scope.maxPeople = _.max(properties, 'MaxOccupants')["MaxOccupants"];

            //beds
            var fBed;
            if ($scope.minBed === $scope.maxBed) fBed = $scope.minBed;
            else fBed = $scope.minBed + "-" + $scope.maxBed;
            if (fBed === 1) fBed = fBed + " Bedroom"
            else fBed = fBed + " Bedrooms";
            $scope.BedroomTxt = fBed;

            // baths
            if ($scope.minBath === $scope.maxBath)
                if ($scope.minBath === 1)
                    $scope.bathTxt = "1 Bathroom"
                else
                    $scope.bathTxt = $scope.minBath + " Bathrooms"
            else
                $scope.bathTxt = $scope.minBath + "-" + $scope.maxBath + " Bathrooms"

            //sleeps
            if ($scope.minPeople === $scope.maxPeople) $scope.sleepTxt = "Sleeps " + $scope.minPeople
            else $scope.sleepTxt = "Sleeps " + $scope.minPeople + "-" + $scope.maxPeople;

            // pets
            $scope.petFriendly = false;
            if (_.filter(properties, function (el) { return el["NumberOfPets"] != 0 }).length > 0)
                $scope.petFriendly = true;

        },
        true // check for strict equality
        );
    $scope.equals = function (arg0, arg1) {
        return arg0 === arg1
    }
    $scope.selectedBedrooms = function () {
        if (Number($scope.$parent.query.Bedrooms) === 0)
            $scope.BedroomTxt =  $scope.minBed + "-" + $scope.maxBed + " Bedrooms";
        else if(Number($scope.$parent.query.Bedrooms) === 1)
            $scope.BedroomTxt = "1 Bedroom";
        else $scope.BedroomTxt = $scope.minBed + " Bedrooms";
    }
}]);

app.controller('leavetownLoves', ["$scope", "$resource", function ($scope, $resource) {
    $scope.loves = _loves;
    delete $scope.loves.ResortID;
    $scope.loves = _.toArray($scope.loves);

    //$scope.resortid = _resortid;
    //$scope.loves = [];
    //var loves = $resource('http://api.leavetown.com/v2/loves/' + $scope.resortid);
    //loves.get(function (newLoves) {
    //    $scope.loves = newLoves.items;
    //})

}])

app.controller("destination-activities-controller", ["$scope", function ($scope) {
    console.log("Activities controller");
    $scope.showActivities = false;
}])

app.controller("property-detail-ctrl", ["$scope", function ($scope) {
    $scope.minrate = _minrate;
    $scope.isZeroRate = _isZeroRate;
}]);

app.directive('resortDetail', function () {
    return {
        //template: '<h4> p is {{property}}</h4>',
        templateUrl: 'resortDetailSnippet.html',
        replace: true,
        //templateUrl: 'properties/resortDetailSnippet.html',
        //link: function (scope, element, attrs) {
        //    attrs.$observe('properties', function (properties) {
        //        scope.properties = properties;
        //    })
        //}
    }
});

app.directive('propertySearch', function () {
    return {
        //template: '<h4> p is {{property}}</h4>',
        templateUrl: 'propertySearchSnippet.html',
        //replace: true,
        //templateUrl: 'properties/propertySearchSnippet.html'
        //link: function (scope, element, attrs) {
        //    attrs.$observe('properties', function (properties) {
        //        scope.properties = properties;
        //    })
        //}
    }
});

app.directive('destinationDirective', function () {
    return {
        templateUrl: 'destinationList.html',
        replace:true
    }
})

app.directive('star', function () {
    return {
        template: '<a  href="#"><i class="fa fa-star"></i></a>',
        replace: true
    }
})


app.directive('halfstar', function () {
    return {
        template: '<a  href="#"><i class="fa fa-star-half-empty"></i></a>',
        replace: true
    }
});

app.factory('activityFactory', function ($http) {

    return {
        get: function (destination) {
            return $http.get('//api.leavetown.com/destination/' + destination + '/activities');
        }
    };
});

app.factory('contactFactory', function ($http) {
    return {
        post: function (info) {
            return $http.post('//api.leavetown.com/contactus', info);
        }
    }
})

app.factory('propertyFactory', function ($http) {
    return {
        getFromDestination: function (destination, checkin, checkout) {
            var r;
            if (!(checkin && checkout))
                r = $http.get('//api.leavetown.com/v2/destination/' + destination + '?r=' + randomString(10));
            else r = $http.get('//api.leavetown.com/v2/destination/' + destination + '/' + checkin.replace(/\//g, '-') + '/' + checkout.replace(/\//g, '-') + '?r=' + randomString(10));
            return r.then(function (d) {
                d = d.data;
                var properties = _.toArray(d[0]);
                var resorts = _.toArray(d[1]);
                var destination = d[2];
                var images = _.toArray(d[3]);
                resorts.forEach(function (el) {
                    el.properties = properties.filter(function (prop) { return prop.RID === el.ResortID })
                    el.minrate = _.min(_.pluck(el.properties, 'MinRate'));
                    el.imgs = _.filter(images, function (img) {
                        return el.ResortID === img.RefID;
                    });
                    el.imgs = _.sortBy(el.imgs,'ResourceSort')
                })
                return [properties, resorts, destination, images];
            })
        },
        getFromResort: function (resort, checkin, checkout) {
            //-- Table0: Destination
            //-- Table1: Resort
            //-- Table2: Properties
            //-- Table3: Activities
            //-- Table4: Amenties
            //-- Table5: Policies
            //-- Table6: Images
            var r;
            if (!(checkin && checkout))
                r = $http.get('//api.leavetown.com/resort/' + resort);
            else
                r = $http.get('//api.leavetown.com/resort/' + resort + '/' + checkin.replace(/\//g, '-') + '/' + checkout.replace(/\//g, '-'))
            return r.then(function (d) {
                d.data[0] = d.data[0][0];
                d.data[1] = d.data[1][0];// resort;
                delete d.data[7][0].ResortID;
                d.data[7] = _.toArray(d.data[7][0]);
                return d.data;
                })
            }
        }
    }
)

//app.factory('imageFactory', function ($http) {
//    return {
//        get: function (url, size) {
//            url.replace(getFileExtention(url),"_" + size + "." + getFileExtention(url))
//            return $http.get(url);
//        }
//    }
//})
function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1);
        if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
    }
    return "";
}

function rmCookie(cname) {
    document.cookie = cname + '=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
};

function randomString( n ) {
    var r="";
    while(n--)r+=String.fromCharCode((r=Math.random()*62|0,r+=r>9?(r<36?55:61):48));
    return r;
}
