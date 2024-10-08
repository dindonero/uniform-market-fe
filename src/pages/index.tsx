import Head from "next/head";
import Image from "next/image";
import styles from "@/styles/Home.module.css";
import { useState } from "react";
import BidBox from "../../components/BidBox";
import Link from "next/link";
import SellBox from "../../components/SellBox";
import Slider from "../../components/Slider";
import CombinedOrdersBox from "../../components/CombinedOrdersBox";
import ClaimBox from "../../components/ClaimBox";
import { Box, Select } from "@chakra-ui/react";
import { AppProvider } from "../../components/AppContext";
import RegionDropdownList from "../../components/RegionDropdownList";

export default function Home() {
  const [isNetworkSwitchHighlighted, setIsNetworkSwitchHighlighted] =
    useState(false);
  const [isConnectHighlighted, setIsConnectHighlighted] = useState(false);

  const [selected, setSelected] = useState(1);

  const closeAll = () => {
    setIsNetworkSwitchHighlighted(false);
    setIsConnectHighlighted(false);
  };
  return (
    <div className="flex flex-col space-y-10">
      <AppProvider>
        <Head>
          <title>COMMUNITAS Energy Market</title>
          <link rel="icon" href="/communitas.ico" />
        </Head>
        <header>
          <div
            className={styles.backdrop}
            style={{
              opacity:
                isConnectHighlighted || isNetworkSwitchHighlighted ? 1 : 0,
            }}
          />
          <div className={styles.header}>
            <div className={styles.logo}>
              <Link href="/">
                <Image
                  src="/communitas.png"
                  alt="COMMUNITAS logo"
                  height="32"
                  width="203"
                />
              </Link>
            </div>
            <RegionDropdownList />
            <div className={styles.buttons}>
              <div
                onClick={closeAll}
                className={`${styles.highlight} ${
                  isNetworkSwitchHighlighted ? styles.highlightSelected : ``
                }`}
              >
                <w3m-network-button />
              </div>
              <div
                onClick={closeAll}
                className={`${styles.highlight} ${
                  isConnectHighlighted ? styles.highlightSelected : ``
                }`}
              >
                <w3m-button />
              </div>
            </div>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
          <Slider selected={selected} setSelected={setSelected} />
          {selected == 1 ? <BidBox /> : ""}
          {selected == 2 ? <SellBox /> : ""}
          {selected == 3 ? <CombinedOrdersBox /> : ""}
          {selected == 4 ? <ClaimBox /> : ""}
        </div>
      </AppProvider>
    </div>
  );
}
