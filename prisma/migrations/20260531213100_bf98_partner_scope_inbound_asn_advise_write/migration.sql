-- BF-98: scoped mutation pilot — allow Partner API keys to advise inbound ASNs.
ALTER TYPE "WmsPartnerApiKeyScope" ADD VALUE 'INBOUND_ASN_ADVISE_WRITE';
