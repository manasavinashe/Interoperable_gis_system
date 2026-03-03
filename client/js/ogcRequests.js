function getCapabilities() {
    console.log("Button clicked")
    const url = "http://localhost:8080/geoserver/wms?service=WMS&version=1.1.1&request=GetCapabilities";
  
    fetch(url)
      .then(response => response.text())
      .then(data => {
        document.getElementById("output").textContent = data;

        // Show raw xml
        document.getElementById("output").textContent = data;

        //parse XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(data, "text/xml");

        //Extract layers names 
        const layers = xmlDoc.getElementsByTagName("Name");

        console.log("Available Layers:");

        for (let i = 0; i < layers.length; i++ ){
            console.log(layers[i].textContent);
        }
        const layerList = document.getElementById("layerList");
        layerList.innerHTML = "";

        for (let i = 0; i < layers.length; i++) {
            const li = document.createElement("li");
            li.textContent = layers[i].textContent;
            layerList.appendChild(li);
        }
      })
      .catch(error => console.error("Error:", error));
  }