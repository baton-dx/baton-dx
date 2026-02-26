class BatonDx < Formula
  desc "CLI package manager for Developer Experience & AI configuration"
  homepage "https://github.com/baton-dx/baton-dx"
  url "https://registry.npmjs.org/@baton-dx/cli/-/cli-0.11.0.tgz"
  sha256 "7a50e5502a3713f3da34d0c19c54673181215987617170d487a8abef8fb6d22b"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/baton --version")
  end
end
