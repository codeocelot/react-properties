var PropertyList = React.createClass({
  render:function(){
    var rows = [];

    var fProperties = [];
    var numBedrooms = +this.props.bedrooms;

    this.props.properties.forEach(function(el){
      if(numBedrooms === 0)
        fProperties.push(el)
      else if(el.NumberBedrooms === numBedrooms)
        fProperties.push(el);
    })
    console.log("property list",numBedrooms,fProperties,this.props)
    var propertyNodes = fProperties.map(function(property){
      return (
        <Property name={property.PropertyName}>
          {property}
        </Property>
      );
    });
    return(
      <div className="propertyList">
        {propertyNodes}
      </div>
    );
  },
})
var Property = React.createClass({
  render:function(){
    return (
      <div className="property">
        <h2>{this.props.name}</h2>
        <p dangerouslySetInnerHTML={{__html:this.props.children.ShortDescription}}></p>
        <img src={"https://leavetown.com/images/property/" + this.props.children.ImageURL}></img>
      </div>
    )
  }
})

var SearchBar = React.createClass({
  handleSearchChange:function(){
    this.props.onSearchInput(
      this.state.checkin,
      this.state.checkout,
      this.refs.selectedDestination.value,
      this.refs.selectedBedrooms.value
    )
  },
  handleFilterChange:function(){
    this.props.onFilterInput(
      this.refs.selectedBedrooms.value
    )
    // this.props.onFilterInput(
    //   this.state.checkin,
    //   this.state.checkout,
    //   this.refs.selectedDestination.value,
    //   this.refs.numBedrooms.value
    // )
  },
  componentDidMount:function(){
    // $(function(){
      var self = this;
      $('.daterangepicker input[name="daterange"]').daterangepicker(
          {
            minDate: moment(),
          },
          function(start, end, label) {
            // TODO: Do something here when values are inputed
            console.log(start,end)
            self.setState({
              checkin:start,
              checkout:end
            });
            self.handleSearchChange();
      }
    )
  },
  render:function(){
    return (
      <div className="user-input">

        <div className="daterangepicker form-group" id="dateSelect">
          <label>Checkin</label>
          <input className="form-control"
            placeholder="Checkin -> Checkout"
            type="text"
            name="daterange"
            // onChange={this.handleChange}
            ref="selectedDates"
            //value="Select your dates"
            placeholder="Select your dates"
            //value={this.props.checkin + ' - ' + this.props.checkout}
            />
        </div>
        <select className="destSelect" onChange={this.handleSearchChange} value={this.props.destination} ref="selectedDestination">
          <option value="canmore">Canmore</option>
          <option value="jasper">Jasper</option>
        </select>
        <select className="numBedrooms" onChange={this.handleFilterChange}
        value={this.props.bedrooms} ref="selectedBedrooms">
          <option value="0">No Preference</option>
          <option value="1">One</option>
          <option value="2">Two</option>
          <option value="3">Three</option>
        </select>
      </div>
    )
  }
})

var FilteredPropertyList = React.createClass({
  getPropertiesFromServer:function(dest,cin,cout){
    dest = dest || '', cin = cin || '', cout = cout || '';
    $.ajax({
      url:this.props.url + dest + '/' + cin + '/' + cout ,
      dataType:'json',
      cache:false,
      success:function(data){
        console.log(data[0])
        this.setState({properties:data[0]});
      }.bind(this),
      error:function(xhr,status,err){
        console.error(this.props.url,status.err.toString());
      }.bind(this)
    });
  },
  getInitialState:function(){
    return {
      properties:[],
      destination:'',
      checkin:moment().format('MM/DD/YYYY'),
      checkout:moment().format('MM/DD/YYYY'),
      numBedrooms:0,
      //dates:'',
    }
  },
  handleSearchInput:function(checkin,checkout,destination){
    if(destination,checkin,checkout)
      this.getPropertiesFromServer(destination,checkin.format('MM-DD-YYYY'),checkout.format('MM-DD-YYYY'))
  },
  handleFilterInput:function(numBedrooms){
    this.setState({numBedrooms:numBedrooms})
  },

  render:function(){
      return (
        <div className="filteredPropertyList">
        <SearchBar
          // dates={this.state.dates}
          checkin={this.state.checkin}
          checkout={this.state.checkout}
          destination={this.state.destination}
          onSearchInput={this.handleSearchInput}
          onFilterInput={this.handleFilterInput}
        />
        <PropertyList properties={this.state.properties} bedrooms={this.state.numBedrooms} />
        </div>
      )
    },
})

ReactDOM.render(
  <FilteredPropertyList url={"https://api.leavetown.com/destination/"}/>,
  document.getElementById('content')
)
