import { Html, Head, Main, NextScript } from "expo-router/html";

export default function RootHtml() {
  return (
    <Html lang="fr">
      <Head>

        {/* HERE MAPS */}
        <script src="https://js.api.here.com/v3/3.1/mapsjs-core.js"></script>
        <script src="https://js.api.here.com/v3/3.1/mapsjs-service.js"></script>
        <script src="https://js.api.here.com/v3/3.1/mapsjs-mapevents.js"></script>
        <script src="https://js.api.here.com/v3/3.1/mapsjs-ui.js"></script>

        <link
          rel="stylesheet"
          href="https://js.api.here.com/v3/3.1/mapsjs-ui.css"
        />

      </Head>

      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}